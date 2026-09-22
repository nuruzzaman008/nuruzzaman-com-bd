<?php

namespace Tests\Feature;

use App\Enums\LicenseStatus;
use App\Enums\Role as RoleEnum;
use App\Jobs\SendNotificationEmail;
use App\Models\ContactMessage;
use App\Models\Course;
use App\Models\CourseInstructor;
use App\Models\CourseQuestion;
use App\Models\CourseQuestionReply;
use App\Models\Enrollment;
use App\Models\NotificationEmail;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\SoftwareLicense;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\NotificationType;
use App\Services\Notifications\Notifier;
use App\Support\Audit;
use App\Support\Reference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Who hears about what: each event reaches the people allowed to act on it,
 * and nobody else.
 */
class NotificationEventsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
    }

    /** @return list<string> */
    private function typesFor(User $user): array
    {
        return $user->notifications()->pluck('type')->sort()->values()->all();
    }

    private function emailsFor(User $user): int
    {
        return NotificationEmail::query()->where('user_id', $user->getKey())->where('source', 'notification')->count();
    }

    public function test_a_paid_order_tells_order_staff_and_the_customer(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $support = $this->userWithRole(RoleEnum::Support);
        $editor = $this->userWithRole(RoleEnum::Editor);
        $customer = $this->customer();
        $order = Order::factory()->for($customer)->create(['billing_name' => 'Rahim Uddin', 'total_minor' => 1_510_000]);

        $order->statusEvents()->create(['from_status' => 'pending_payment', 'to_status' => 'paid']);

        $this->assertSame(['order.paid'], $this->typesFor($admin));
        $this->assertSame(['order.paid'], $this->typesFor($support));
        $this->assertSame([], $this->typesFor($editor));
        $this->assertSame(['order.confirmed'], $this->typesFor($customer));

        $data = $admin->notifications()->first()->data;
        $this->assertSame($order->number, $data['number']);
        $this->assertSame(1_510_000, $data['amount_minor']);
        $this->assertSame('Rahim Uddin', $data['customer']);

        // Administrators get money by email; other staff opt in; the customer
        // already gets the receipt, so no second email.
        $this->assertSame(1, $this->emailsFor($admin));
        $this->assertSame(0, $this->emailsFor($support));
        $this->assertSame(0, $this->emailsFor($customer));
        Queue::assertPushed(SendNotificationEmail::class, 1);
    }

    public function test_other_status_changes_are_not_announced(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $order = Order::factory()->for($this->customer())->create();

        $order->statusEvents()->create(['from_status' => 'draft', 'to_status' => 'pending_payment']);

        $this->assertSame([], $this->typesFor($admin));
    }

    public function test_the_person_who_acted_is_not_told_about_it(): void
    {
        $approver = $this->userWithRole(RoleEnum::Admin);
        $colleague = $this->userWithRole(RoleEnum::Admin);
        $order = Order::factory()->for($this->customer())->create();

        $this->actingAs($approver);
        $order->statusEvents()->create(['from_status' => 'pending_payment', 'to_status' => 'paid', 'actor_id' => $approver->id]);

        $this->assertSame([], $this->typesFor($approver));
        $this->assertSame(['order.paid'], $this->typesFor($colleague));
    }

    public function test_a_manual_payment_waits_for_the_people_who_verify_payments(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $support = $this->userWithRole(RoleEnum::Support);
        $order = Order::factory()->for($this->customer())->create();
        $payment = Payment::query()->create([
            'order_id' => $order->id, 'gateway' => 'manual', 'reference' => Reference::payment(),
            'status' => 'pending', 'currency' => 'BDT', 'amount_minor' => 250_000,
        ]);

        Audit::record('payment.manual_submitted', $payment, ['method' => 'bkash']);

        $this->assertSame(['payment.submitted'], $this->typesFor($admin));
        // Support can see orders but not verify payments.
        $this->assertSame([], $this->typesFor($support));
        $this->assertSame('bkash', $admin->notifications()->first()->data['method']);
    }

    public function test_a_ticket_opens_once_and_replies_go_to_the_other_side(): void
    {
        $support = $this->userWithRole(RoleEnum::Support);
        $customer = $this->customer();
        $ticket = SupportTicket::query()->create([
            'reference' => 'TCK-TEST-0001', 'user_id' => $customer->id, 'name' => 'Karim', 'email' => $customer->email,
            'subject' => 'Licence not activating', 'status' => 'open',
        ]);

        $ticket->messages()->create(['author_id' => $customer->id, 'author_kind' => 'customer', 'body' => 'It says invalid.']);
        $this->assertSame(['ticket.opened'], $this->typesFor($support));

        $ticket->messages()->create(['author_id' => $support->id, 'author_kind' => 'staff', 'body' => 'Checking now.']);
        $ticket->messages()->create(['author_id' => $support->id, 'author_kind' => 'staff', 'body' => 'Internal: refund?', 'is_internal' => true]);
        $this->assertSame(['ticket.staff_replied'], $this->typesFor($customer));
        $this->assertSame('Checking now.', $customer->notifications()->first()->data['excerpt']);

        $ticket->messages()->create(['author_id' => $customer->id, 'author_kind' => 'customer', 'body' => 'Thanks!']);
        $this->assertSame(['ticket.customer_replied', 'ticket.opened'], $this->typesFor($support));
    }

    public function test_a_question_reaches_administrators_and_that_courses_teachers_only(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $teacher = $this->userWithRole(RoleEnum::Instructor);
        $otherTeacher = $this->userWithRole(RoleEnum::Instructor);
        $student = $this->customer();
        $course = Course::factory()->create();
        CourseInstructor::query()->create(['course_id' => $course->id, 'user_id' => $teacher->id, 'role' => 'instructor', 'position' => 1]);
        $enrollment = Enrollment::query()->create(['user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);

        $question = CourseQuestion::query()->create([
            'course_id' => $course->id, 'enrollment_id' => $enrollment->id, 'user_id' => $student->id, 'title' => 'Why 1.5 factor?',
            'body' => 'In lesson 3 the load factor is 1.5, why?', 'status' => 'in_review',
        ]);

        $this->assertSame(['question.asked'], $this->typesFor($admin));
        $this->assertSame(['question.asked'], $this->typesFor($teacher));
        $this->assertSame([], $this->typesFor($otherTeacher));

        CourseQuestionReply::query()->create([
            'course_question_id' => $question->id, 'user_id' => $teacher->id, 'body' => 'Because of the code.',
            'from_instructor' => true, 'status' => 'published',
        ]);
        CourseQuestionReply::query()->create([
            'course_question_id' => $question->id, 'user_id' => $student->id, 'body' => 'Thank you',
            'from_instructor' => false, 'status' => 'published',
        ]);

        $this->assertSame(['question.answered'], $this->typesFor($student));
        // The answer email is QuestionAnsweredMail's job; no duplicate here.
        $this->assertSame(0, $this->emailsFor($student));
    }

    public function test_a_pending_comment_reaches_moderators(): void
    {
        $editor = $this->userWithRole(RoleEnum::Editor);
        $support = $this->userWithRole(RoleEnum::Support);
        $post = Post::factory()->create();

        PostComment::query()->create([
            'post_id' => $post->id, 'user_id' => $this->customer()->id, 'author_name' => 'Reader',
            'body' => 'Great article', 'status' => 'pending',
        ]);
        PostComment::query()->create([
            'post_id' => $post->id, 'user_id' => $this->customer()->id, 'author_name' => 'Trusted',
            'body' => 'Already approved', 'status' => 'approved',
        ]);

        $this->assertSame(['comment.pending'], $this->typesFor($editor));
        $this->assertSame([], $this->typesFor($support));
    }

    public function test_an_activation_request_reaches_reviewers_and_its_decision_reaches_the_customer(): void
    {
        $support = $this->userWithRole(RoleEnum::Support);
        $customer = $this->customer();
        $order = Order::factory()->for($customer)->paid()->create();
        SoftwareLicense::query()->create([
            'license_code' => Reference::license(), 'user_id' => $customer->id, 'order_id' => $order->id,
            'product_name' => 'NB Engineering Tools', 'status' => LicenseStatus::Issued, 'device_limit' => 3, 'issued_at' => now(),
        ]);

        $this->actingAs($customer)
            ->postJson('/api/v1/account/activation-requests', [
                'order_number' => $order->number, 'machine_id' => 'A1B2-C3D4-E5F6-9F3C', 'autocad_version' => '2025',
            ])
            ->assertCreated();

        $this->assertSame(['activation.requested'], $this->typesFor($support));
        $this->assertSame([], $this->typesFor($customer));
        $this->assertSame('AutoCAD 2025', $support->notifications()->first()->data['autocad_version']);

        $request = $customer->activationRequests()->firstOrFail();
        $request->events()->create(['from_status' => 'submitted', 'to_status' => 'under_review', 'actor_id' => $support->id]);

        $this->assertSame(['activation.updated'], $this->typesFor($customer));
        $this->assertSame('under_review', $customer->notifications()->first()->data['status']);
    }

    public function test_contact_messages_now_reach_support(): void
    {
        $support = $this->userWithRole(RoleEnum::Support);
        $message = ContactMessage::query()->create([
            'name' => 'Salma', 'email' => 'salma@example.com', 'subject' => 'Training for our firm', 'message' => 'Do you run on-site training?',
        ]);

        Audit::record('contact.received', $message, ['email' => $message->email]);

        $this->assertSame(['contact.received'], $this->typesFor($support));
        $this->assertSame('Do you run on-site training?', $support->notifications()->first()->data['excerpt']);
    }

    public function test_a_lockout_is_reported_once_an_hour_not_on_every_attempt(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $support = $this->userWithRole(RoleEnum::Support);

        Audit::record('auth.login_locked', null, ['email' => 'target@example.com']);
        Audit::record('auth.login_locked', null, ['email' => 'target@example.com']);
        Audit::record('auth.login_locked', null, ['email' => 'someone-else@example.com']);

        $this->assertSame(['security.lockout', 'security.lockout'], $this->typesFor($admin));
        $this->assertSame([], $this->typesFor($support));
    }

    public function test_an_announcement_reaches_the_students_still_enrolled(): void
    {
        $course = Course::factory()->create();
        $active = $this->customer();
        $lapsed = $this->customer();
        Enrollment::query()->create(['user_id' => $active->id, 'course_id' => $course->id, 'status' => 'active', 'source' => 'order']);
        Enrollment::query()->create(['user_id' => $lapsed->id, 'course_id' => $course->id, 'status' => 'revoked', 'source' => 'order']);

        $announcement = $course->announcements()->create([
            'user_id' => $this->userWithRole(RoleEnum::Admin)->id, 'title' => 'Live class on Friday',
            'body_markdown' => 'Join at 8pm.', 'published_at' => now(),
        ]);
        Audit::record('course.announcement.created', $announcement, ['course' => $course->slug]);

        $this->assertSame(['course.announcement'], $this->typesFor($active));
        $this->assertSame([], $this->typesFor($lapsed));
        $this->assertSame(1, $this->emailsFor($active));
    }

    public function test_new_accounts_are_shown_in_the_dashboard_without_an_email(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $newcomer = $this->customer(['name' => 'Nabila']);

        Audit::record('auth.registered', $newcomer, ['via' => 'password'], $newcomer->id);

        $this->assertSame(['user.registered'], $this->typesFor($admin));
        $this->assertSame(0, $this->emailsFor($admin));
    }

    public function test_a_failure_to_notify_never_breaks_the_action(): void
    {
        $this->userWithRole(RoleEnum::Admin);
        $order = Order::factory()->for($this->customer())->create();

        // A broken payload: the order must still move on.
        $this->app->instance(Notifier::class, new class extends Notifier
        {
            public function toStaff(NotificationType $type, array $data, ?callable $narrow = null): void
            {
                parent::toStaff($type, ['broken' => fopen('php://memory', 'r')]);
            }
        });

        $order->statusEvents()->create(['from_status' => 'pending_payment', 'to_status' => 'paid']);

        $this->assertDatabaseHas('order_status_events', ['order_id' => $order->id, 'to_status' => 'paid']);
    }
}
