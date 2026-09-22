<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Mail\ContactReplyMail;
use App\Models\ContactMessage;
use App\Models\Course;
use App\Models\CourseInstructor;
use App\Models\CourseQuestion;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\SupportTicket;
use App\Models\User;
use App\Support\Reference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * The dashboard message inbox: one list for tickets, contact messages,
 * questions and comments, each shown only to staff who may act on it, and
 * the "still to do" counts in the bell.
 */
class ConversationInboxTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
    }

    private function ticket(User $customer, string $status = 'open'): SupportTicket
    {
        $ticket = SupportTicket::query()->create([
            'reference' => 'TCK-'.fake()->unique()->numerify('####'), 'user_id' => $customer->id,
            'name' => 'Karim', 'email' => $customer->email, 'mobile' => '01711000000',
            'subject' => 'Licence not activating', 'category' => 'licence', 'status' => $status,
        ]);
        $ticket->messages()->create(['author_id' => $customer->id, 'author_kind' => 'customer', 'body' => 'It says invalid code.']);

        return $ticket;
    }

    private function question(User $student, Course $course): CourseQuestion
    {
        $enrollment = Enrollment::query()->create(['user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);

        return CourseQuestion::query()->create([
            'course_id' => $course->id, 'enrollment_id' => $enrollment->id, 'user_id' => $student->id,
            'title' => 'Why 1.5?', 'body' => 'Why is the load factor 1.5?', 'status' => 'in_review',
        ]);
    }

    public function test_each_kind_reaches_only_the_staff_who_may_act_on_it(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $support = $this->userWithRole(RoleEnum::Support);
        $editor = $this->userWithRole(RoleEnum::Editor);
        $customer = $this->customer();
        $this->ticket($customer);
        ContactMessage::query()->create(['name' => 'Salma', 'email' => 'salma@example.com', 'subject' => 'Training', 'message' => 'Do you run training?']);
        $this->question($customer, Course::factory()->create());
        PostComment::query()->create(['post_id' => Post::factory()->create()->id, 'user_id' => $customer->id, 'author_name' => 'Reader', 'body' => 'Nice', 'status' => 'pending']);

        $kinds = fn (User $user) => collect($this->actingAs($user)->getJson('/api/v1/admin/conversations')->assertOk()->json('data'))
            ->pluck('kind')->sort()->values()->all();

        $this->assertSame(['comment', 'contact', 'question', 'ticket'], $kinds($admin));
        // Support answers tickets and the contact form, and can see course questions.
        $this->assertSame(['contact', 'question', 'ticket'], $kinds($support));
        // Editors moderate comments, and can see the courses they help with.
        $this->assertSame(['comment', 'question'], $kinds($editor));

        $this->actingAs($this->customer())->getJson('/api/v1/admin/conversations')->assertForbidden();
    }

    public function test_the_list_shows_who_wrote_the_last_message_and_what_waits(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $customer = $this->customer(['name' => 'Karim']);
        $open = $this->ticket($customer);
        $answered = $this->ticket($customer, 'pending');
        $answered->messages()->create(['author_id' => $admin->id, 'author_kind' => 'staff', 'body' => 'Fixed, try again.']);
        $answered->messages()->create(['author_id' => $admin->id, 'author_kind' => 'staff', 'body' => 'Internal: refunded', 'is_internal' => true]);

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/conversations?kind=ticket')->assertOk();
        $rows = collect($response->json('data'))->keyBy('key');

        $this->assertTrue($rows[$open->reference]['waiting']);
        $this->assertSame('customer', $rows[$open->reference]['preview_from']);
        $this->assertFalse($rows[$answered->reference]['waiting']);
        // The internal note is never the preview.
        $this->assertSame('Fixed, try again.', $rows[$answered->reference]['preview']);
        $this->assertSame('staff', $rows[$answered->reference]['preview_from']);
        $this->assertSame('/dashboard/messages?c=ticket:'.$open->reference, $rows[$open->reference]['url']);
        $response->assertJsonPath('meta.waiting.ticket', 1);

        $this->actingAs($admin)->getJson('/api/v1/admin/conversations?kind=ticket&filter=waiting')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.key', $open->reference);
    }

    public function test_a_ticket_thread_reads_as_bubbles_with_internal_notes_marked(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin, ['name' => 'Nuruzzaman']);
        $ticket = $this->ticket($customer = $this->customer());
        $ticket->messages()->create(['author_id' => $admin->id, 'author_kind' => 'staff', 'body' => 'Checking.']);
        $ticket->messages()->create(['author_id' => $admin->id, 'author_kind' => 'staff', 'body' => 'Note to self', 'is_internal' => true]);

        $this->actingAs($admin)->getJson("/api/v1/admin/conversations/ticket/{$ticket->reference}")
            ->assertOk()
            ->assertJsonPath('data.person.name', 'Karim')
            ->assertJsonPath('data.messages.0.from', 'customer')
            ->assertJsonPath('data.messages.1.from', 'staff')
            ->assertJsonPath('data.messages.1.author', 'Nuruzzaman')
            ->assertJsonPath('data.messages.2.from', 'note')
            ->assertJsonPath('data.can_reply', true)
            ->assertJsonPath('data.actions.resolve', true);

        $this->actingAs($admin)->getJson('/api/v1/admin/conversations/ticket/TCK-NONE')->assertNotFound();
        $this->actingAs($this->userWithRole(RoleEnum::Editor))
            ->getJson("/api/v1/admin/conversations/ticket/{$ticket->reference}")->assertNotFound();
    }

    /** The same rule as the reply endpoint: CoursePolicy::update (courses.manage, or teaching it). */
    public function test_only_those_who_may_edit_the_course_can_answer_from_the_chat(): void
    {
        $teacher = $this->userWithRole(RoleEnum::Instructor);
        $support = $this->userWithRole(RoleEnum::Support);
        $course = Course::factory()->create();
        CourseInstructor::query()->create(['course_id' => $course->id, 'user_id' => $teacher->id, 'role' => 'instructor', 'position' => 1]);
        $question = $this->question($this->customer(), $course);

        $this->actingAs($teacher)->getJson("/api/v1/admin/conversations/question/{$question->id}")
            ->assertOk()->assertJsonPath('data.can_reply', true)
            ->assertJsonPath('data.messages.0.body', 'Why is the load factor 1.5?');
        // Support can read course questions but not answer them.
        $this->actingAs($support)->getJson("/api/v1/admin/conversations/question/{$question->id}")
            ->assertOk()->assertJsonPath('data.can_reply', false);
    }

    public function test_a_comment_is_answered_by_moderating_it(): void
    {
        $editor = $this->userWithRole(RoleEnum::Editor);
        $comment = PostComment::query()->create([
            'post_id' => Post::factory()->create(['title' => 'Slab design'])->id, 'user_id' => $this->customer()->id,
            'author_name' => 'Reader', 'body' => 'Very helpful', 'rating' => 5, 'status' => 'pending',
        ]);

        $this->actingAs($editor)->getJson("/api/v1/admin/conversations/comment/{$comment->id}")
            ->assertOk()
            ->assertJsonPath('data.title', 'Slab design')
            ->assertJsonPath('data.can_reply', false)
            ->assertJsonPath('data.actions.moderate', true);
    }

    public function test_a_contact_message_is_answered_by_email_and_kept(): void
    {
        $support = $this->userWithRole(RoleEnum::Support, ['name' => 'Support desk']);
        $message = ContactMessage::query()->create([
            'name' => 'Salma', 'email' => 'salma@example.com', 'subject' => 'Training', 'message' => 'Do you run on-site training?',
        ]);

        $this->actingAs($support)->postJson("/api/v1/admin/contact-messages/{$message->id}/replies", ['body' => 'Yes, we do. Call us.'])
            ->assertCreated();

        Mail::assertQueued(ContactReplyMail::class, fn (ContactReplyMail $mail) => $mail->hasTo('salma@example.com')
            && $mail->reply->body === 'Yes, we do. Call us.');
        $this->assertNotNull($message->fresh()->handled_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'contact.replied']);

        $this->actingAs($support)->getJson("/api/v1/admin/conversations/contact/{$message->id}")
            ->assertOk()
            ->assertJsonPath('data.waiting', false)
            ->assertJsonPath('data.messages.1.from', 'staff')
            ->assertJsonPath('data.messages.1.author', 'Support desk');

        // Only those who answer support may write back.
        $this->actingAs($this->userWithRole(RoleEnum::Editor))
            ->postJson("/api/v1/admin/contact-messages/{$message->id}/replies", ['body' => 'Hello there'])->assertForbidden();
        $this->actingAs($support)->postJson("/api/v1/admin/contact-messages/{$message->id}/replies", ['body' => ''])->assertUnprocessable();
    }

    public function test_the_reply_email_escapes_what_the_stranger_wrote(): void
    {
        $message = ContactMessage::query()->create([
            'name' => 'X', 'email' => 'x@example.com', 'subject' => 'Hi', 'message' => '<script>alert(1)</script>',
        ]);
        $reply = $message->replies()->create(['user_id' => null, 'body' => 'Thanks']);

        $html = (new ContactReplyMail($message, $reply, 'Support'))->render();

        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
    }

    public function test_the_bell_carries_what_is_still_to_do_for_this_person(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $editor = $this->userWithRole(RoleEnum::Editor);
        $customer = $this->customer();
        $this->ticket($customer);
        ContactMessage::query()->create(['name' => 'A', 'email' => 'a@example.com', 'subject' => 'S', 'message' => 'M']);
        PostComment::query()->create(['post_id' => Post::factory()->create()->id, 'user_id' => $customer->id, 'author_name' => 'R', 'body' => 'B', 'status' => 'pending']);
        $order = Order::factory()->for($customer)->create();
        $payment = Payment::query()->create([
            'order_id' => $order->id, 'gateway' => 'manual', 'reference' => Reference::payment(),
            'status' => 'pending', 'currency' => 'BDT', 'amount_minor' => 100_000,
        ]);
        DB::table('manual_payment_submissions')->insert([
            'order_id' => $order->id, 'payment_id' => $payment->id, 'method' => 'bkash', 'transaction_id' => 'TX1',
            'sender' => '01700000000', 'recipient' => '01800000000', 'status' => 'pending', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $pending = collect($this->actingAs($admin)->getJson('/api/v1/admin/notifications/feed')->assertOk()->json('meta.pending'))
            ->pluck('count', 'key')->all();
        $this->assertSame(1, $pending['payments']);
        $this->assertSame(1, $pending['tickets']);
        $this->assertSame(1, $pending['contacts']);
        $this->assertSame(1, $pending['comments']);
        $this->actingAs($admin)->getJson('/api/v1/admin/notifications/feed')->assertJsonPath('meta.messages_waiting', 3);

        $editorPending = collect($this->actingAs($editor)->getJson('/api/v1/admin/notifications/feed')->json('meta.pending'))->pluck('key')->all();
        $this->assertEqualsCanonicalizing(['questions', 'comments'], $editorPending);

        // Customers have none of this.
        $this->actingAs($customer)->getJson('/api/v1/me/notifications/feed')->assertOk()->assertJsonMissingPath('meta.pending');
    }

    public function test_notifications_open_the_chat_and_show_who_they_are_about(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $customer = $this->customer(['name' => 'Karim']);
        $customer->profile()->updateOrCreate(['user_id' => $customer->id], ['avatar_path' => 'profile-photos/karim.jpg']);
        $ticket = $this->ticket($customer);

        $item = $this->actingAs($admin)->getJson('/api/v1/admin/notifications/feed')->assertOk()->json('data.0');

        $this->assertSame('ticket.opened', $item['type']);
        $this->assertSame(['kind' => 'ticket', 'key' => $ticket->reference], $item['conversation']);
        $this->assertSame('Karim', $item['person']['name']);
        $this->assertSame("/api/v1/admin/users/{$customer->id}/avatar", $item['person']['avatar_url']);
        $this->assertSame('/dashboard/messages?c=ticket:'.$ticket->reference, $item['url']);
    }
}
