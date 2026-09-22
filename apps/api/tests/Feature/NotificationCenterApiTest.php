<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Jobs\SendNotificationEmail;
use App\Mail\NotificationMail;
use App\Models\NotificationEmail;
use App\Models\User;
use App\Notifications\NotificationPresenter;
use App\Notifications\NotificationType;
use App\Services\Notifications\Notifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The notification center API: the bell, the list, read state, preferences,
 * the email log and the housekeeping behind it.
 */
class NotificationCenterApiTest extends TestCase
{
    use RefreshDatabase;

    private function notify(User $user, NotificationType $type, array $data = []): string
    {
        Queue::fake();
        $before = $user->notifications()->pluck('id');
        app(Notifier::class)->toUser($user, $type, $data + ['number' => 'NB-2026-000123', 'amount_minor' => 1_000_000]);

        // Not latest(): several are written within the same second.
        return $user->notifications()->whereNotIn('id', $before)->value('id');
    }

    public function test_staff_read_theirs_under_the_dashboard_and_only_after_the_second_step(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $this->notify($admin, NotificationType::OrderPaid);

        // Signed in, but this session has not typed the code yet.
        $this->be($admin)->getJson('/api/v1/admin/notifications/feed')->assertForbidden();
        // And not around the second step through the customer address.
        $this->actingAs($admin)->getJson('/api/v1/me/notifications/feed')->assertForbidden();

        $this->actingAs($admin)->getJson('/api/v1/admin/notifications/feed')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('meta.unread', 1)
            ->assertJsonPath('data.0.type', 'order.paid')
            ->assertJsonPath('data.0.url', '/dashboard/orders/NB-2026-000123');
    }

    public function test_customers_use_the_account_address_and_never_the_dashboard_one(): void
    {
        $customer = $this->customer();
        $this->notify($customer, NotificationType::OrderConfirmed);

        $this->actingAs($customer)->getJson('/api/v1/admin/notifications')->assertForbidden();
        $this->actingAs($customer)->getJson('/api/v1/me/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.url', '/account/orders/NB-2026-000123');
    }

    public function test_signed_out_visitors_get_nothing(): void
    {
        $this->getJson('/api/v1/me/notifications/feed')->assertUnauthorized();
        $this->getJson('/api/v1/admin/notifications/feed')->assertUnauthorized();
    }

    public function test_it_is_worded_in_the_language_asked_for(): void
    {
        $customer = $this->customer(['locale' => 'bn']);
        $this->notify($customer, NotificationType::OrderConfirmed);

        $this->actingAs($customer)->getJson('/api/v1/me/notifications/feed')
            ->assertJsonPath('data.0.title', 'আপনার অর্ডার নিশ্চিত হয়েছে · NB-2026-000123')
            ->assertJsonPath('data.0.body', '৳ 10,000.00');

        $this->actingAs($customer)->getJson('/api/v1/me/notifications/feed?locale=en')
            ->assertJsonPath('data.0.title', 'Your order is confirmed · NB-2026-000123');
    }

    public function test_the_list_filters_by_unread_and_category_and_pages(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $this->notify($admin, NotificationType::OrderPaid);
        $ticket = $this->notify($admin, NotificationType::TicketOpened, ['reference' => 'TCK-1']);
        $admin->notifications()->whereKey($ticket)->update(['read_at' => now()]);

        $this->actingAs($admin)->getJson('/api/v1/admin/notifications?filter=unread')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.type', 'order.paid')
            ->assertJsonPath('meta.unread', 1);

        $this->actingAs($admin)->getJson('/api/v1/admin/notifications?category=support')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.read', true);

        // Customer categories are not offered to staff, and the reverse.
        $this->actingAs($admin)->getJson('/api/v1/admin/notifications?category=nonsense')->assertUnprocessable();
    }

    public function test_read_unread_delete_and_the_bulk_actions(): void
    {
        $customer = $this->customer();
        $first = $this->notify($customer, NotificationType::OrderConfirmed);
        $second = $this->notify($customer, NotificationType::TicketStaffReplied, ['reference' => 'TCK-2']);

        $this->actingAs($customer)->postJson("/api/v1/me/notifications/{$first}/read")->assertJsonPath('meta.unread', 1);
        $this->actingAs($customer)->postJson("/api/v1/me/notifications/{$first}/unread")->assertJsonPath('meta.unread', 2);
        $this->actingAs($customer)->postJson('/api/v1/me/notifications/read-all')->assertJsonPath('meta.unread', 0);
        $this->actingAs($customer)->deleteJson("/api/v1/me/notifications/{$second}")->assertOk();
        $this->assertSame(1, $customer->notifications()->count());

        $this->actingAs($customer)->deleteJson('/api/v1/me/notifications/read')->assertOk();
        $this->assertSame(0, $customer->notifications()->count());
    }

    public function test_nobody_can_touch_someone_elses_notification(): void
    {
        $owner = $this->customer();
        $other = $this->customer();
        $id = $this->notify($owner, NotificationType::OrderConfirmed);

        $this->actingAs($other)->postJson("/api/v1/me/notifications/{$id}/read")->assertNotFound();
        $this->actingAs($other)->deleteJson("/api/v1/me/notifications/{$id}")->assertNotFound();
        $this->actingAs($other)->postJson('/api/v1/me/notifications/not-a-uuid/read')->assertNotFound();

        $this->assertNull($owner->notifications()->first()->read_at);
    }

    public function test_preferences_decide_the_email_never_the_notification(): void
    {
        Queue::fake();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $support = $this->userWithRole(RoleEnum::Support);

        $this->actingAs($admin)->getJson('/api/v1/me/notification-preferences')
            ->assertOk()
            ->assertJsonFragment(['category' => 'orders', 'email' => true, 'default' => true])
            ->assertJsonFragment(['category' => 'users', 'email' => false, 'default' => false]);

        $this->actingAs($admin)->putJson('/api/v1/me/notification-preferences', ['email' => ['orders' => false]])
            ->assertOk()->assertJsonFragment(['category' => 'orders', 'email' => false, 'default' => true]);
        $this->actingAs($support)->putJson('/api/v1/me/notification-preferences', ['email' => ['orders' => true]])->assertOk();

        // The order is paid by a gateway callback: nobody is signed in.
        $this->app['auth']->forgetGuards();
        app(Notifier::class)->toStaff(NotificationType::OrderPaid, ['number' => 'NB-1']);

        $this->assertSame(1, $admin->notifications()->count());
        $this->assertSame(1, $support->notifications()->count());
        $this->assertDatabaseMissing('notification_emails', ['user_id' => $admin->id]);
        $this->assertDatabaseHas('notification_emails', ['user_id' => $support->id, 'type' => 'order.paid', 'status' => 'pending']);
    }

    public function test_a_customer_cannot_set_staff_categories(): void
    {
        $customer = $this->customer();

        $this->actingAs($customer)->putJson('/api/v1/me/notification-preferences', ['email' => ['security' => true]])->assertOk();

        $this->assertDatabaseMissing('notification_preferences', ['user_id' => $customer->id, 'category' => 'security']);
    }

    public function test_the_email_is_sent_from_the_log_and_the_outcome_recorded(): void
    {
        Mail::fake();
        $admin = $this->userWithRole(RoleEnum::Admin, ['locale' => 'en']);
        $this->notify($admin, NotificationType::OrderPaid, ['customer' => 'Rahim']);
        $email = NotificationEmail::query()->where('user_id', $admin->id)->firstOrFail();

        (new SendNotificationEmail($email->id))->handle();

        $email->refresh();
        $this->assertSame('sent', $email->status);
        $this->assertSame(1, $email->attempts);
        Mail::assertSent(NotificationMail::class, fn (NotificationMail $mail) => $mail->hasTo($admin->email)
            && $mail->notification['title'] === 'New paid order · NB-2026-000123'
            && $mail->notification['body'] === 'Rahim · ৳ 10,000.00');

        // Sent is sent: running it again does nothing.
        (new SendNotificationEmail($email->id))->handle();
        $this->assertSame(1, $email->fresh()->attempts);
    }

    public function test_a_failed_send_is_recorded_with_its_reason(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $this->notify($admin, NotificationType::OrderPaid);
        $email = NotificationEmail::query()->where('user_id', $admin->id)->firstOrFail();
        config(['mail.default' => 'missing-mailer']);

        (new SendNotificationEmail($email->id))->handle();

        $email->refresh();
        $this->assertSame('failed', $email->status);
        $this->assertStringContainsString('missing-mailer', (string) $email->failure_reason);
        $this->assertSame(1, $email->attempts);
    }

    public function test_the_email_is_escaped_html_not_markdown(): void
    {
        $mail = new NotificationMail([
            'title' => 'New support ticket',
            'body' => '<script>alert(1)</script> [click](https://evil.example)',
            'detail' => null,
            'url' => '/dashboard/support-tickets',
        ], 'en', true, 1);

        $html = $mail->render();

        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringNotContainsString('href="https://evil.example"', $html);
        $this->assertStringContainsString('/dashboard/notifications/settings', $html);
    }

    public function test_failed_emails_are_retried_on_schedule_up_to_a_limit(): void
    {
        Queue::fake();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $due = NotificationEmail::query()->create([
            'user_id' => $admin->id, 'type' => 'order.paid', 'recipient' => $admin->email, 'payload' => [],
            'status' => 'failed', 'attempts' => 1, 'last_attempt_at' => now()->subMinutes(15),
        ]);
        $recent = NotificationEmail::query()->create([
            'user_id' => $admin->id, 'type' => 'order.paid', 'recipient' => $admin->email, 'payload' => [],
            'status' => 'failed', 'attempts' => 1, 'last_attempt_at' => now()->subMinute(),
        ]);
        $exhausted = NotificationEmail::query()->create([
            'user_id' => $admin->id, 'type' => 'order.paid', 'recipient' => $admin->email, 'payload' => [],
            'status' => 'failed', 'attempts' => 5, 'last_attempt_at' => now()->subHour(),
        ]);

        $this->artisan('notifications:retry-emails')->assertSuccessful();

        Queue::assertPushed(SendNotificationEmail::class, fn ($job) => $job->emailId === $due->id);
        Queue::assertNotPushed(SendNotificationEmail::class, fn ($job) => in_array($job->emailId, [$recent->id, $exhausted->id], true));
    }

    public function test_the_email_log_is_for_administrators_and_can_resend(): void
    {
        Queue::fake();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $editor = $this->userWithRole(RoleEnum::Editor);
        $failed = NotificationEmail::query()->create([
            'user_id' => $admin->id, 'type' => 'ticket.opened', 'recipient' => 'staff@example.com', 'payload' => [],
            'status' => 'failed', 'attempts' => 5, 'failure_reason' => 'Connection refused', 'last_attempt_at' => now(),
        ]);
        NotificationEmail::query()->create([
            'source' => 'mail', 'type' => 'OrderReceiptMail', 'recipient' => 'buyer@example.com', 'subject' => 'Your receipt',
            'status' => 'sent', 'attempts' => 1, 'sent_at' => now(),
        ]);
        DB::table('failed_jobs')->insert([
            'uuid' => $uuid = (string) Str::uuid(), 'connection' => 'database', 'queue' => 'default',
            'payload' => json_encode(['displayName' => 'App\\Mail\\QuestionAnsweredMail']),
            'exception' => "Symfony\\Component\\Mailer\\Exception\\TransportException: Connection refused\n#0 ...", 'failed_at' => now(),
        ]);
        DB::table('failed_jobs')->insert([
            'uuid' => $other = (string) Str::uuid(), 'connection' => 'database', 'queue' => 'default',
            'payload' => json_encode(['displayName' => 'App\\Jobs\\ReconcilePayments']), 'exception' => 'x', 'failed_at' => now(),
        ]);

        $this->actingAs($editor)->getJson('/api/v1/admin/notification-emails')->assertForbidden();

        $this->actingAs($admin)->getJson('/api/v1/admin/notification-emails?locale=en')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.1.label', 'New support ticket')
            ->assertJsonPath('data.1.can_retry', true)
            ->assertJsonPath('data.0.can_retry', false)
            ->assertJsonPath('meta.summary.failed', 1)
            ->assertJsonCount(1, 'failed_jobs')
            ->assertJsonPath('failed_jobs.0.job', 'QuestionAnsweredMail');

        $this->actingAs($admin)->getJson('/api/v1/admin/notification-emails?status=failed')->assertJsonCount(1, 'data');

        $this->actingAs($admin)->postJson("/api/v1/admin/notification-emails/{$failed->id}/retry")->assertOk();
        Queue::assertPushed(SendNotificationEmail::class, fn ($job) => $job->emailId === $failed->id);

        // Only mail jobs can be put back from here.
        $this->actingAs($admin)->postJson("/api/v1/admin/notification-emails/jobs/{$other}/retry")->assertNotFound();
        $this->assertDatabaseHas('failed_jobs', ['uuid' => $uuid]);
    }

    public function test_cleanup_removes_old_read_notifications_and_old_sent_email_only(): void
    {
        $customer = $this->customer();
        $old = $this->notify($customer, NotificationType::OrderConfirmed);
        $oldUnread = $this->notify($customer, NotificationType::OrderConfirmed);
        $recent = $this->notify($customer, NotificationType::OrderConfirmed);
        $customer->notifications()->whereKey($old)->update(['read_at' => now()->subDays(100), 'created_at' => now()->subDays(120)]);
        $customer->notifications()->whereKey($oldUnread)->update(['created_at' => now()->subDays(200)]);
        $customer->notifications()->whereKey($recent)->update(['read_at' => now()->subDays(3)]);
        NotificationEmail::query()->create(['type' => 'x', 'recipient' => 'a@b.c', 'status' => 'sent', 'sent_at' => now()->subDays(200)]);
        NotificationEmail::query()->create(['type' => 'x', 'recipient' => 'a@b.c', 'status' => 'failed', 'failed_at' => now()->subDays(200)]);

        $this->artisan('notifications:prune')->assertSuccessful();

        $this->assertEqualsCanonicalizing([$oldUnread, $recent], $customer->notifications()->pluck('id')->all());
        $this->assertSame(['failed'], NotificationEmail::query()->pluck('status')->all());
    }

    public function test_the_sites_other_emails_are_logged_once_and_ours_are_not_doubled(): void
    {
        Mail::raw('Hello', fn ($message) => $message->to('reader@example.com')->subject('A plain message'));

        $this->assertDatabaseHas('notification_emails', [
            'source' => 'mail', 'recipient' => 'reader@example.com', 'subject' => 'A plain message', 'status' => 'sent',
        ]);

        $admin = $this->userWithRole(RoleEnum::Admin);
        $this->notify($admin, NotificationType::OrderPaid);
        (new SendNotificationEmail(NotificationEmail::query()->where('source', 'notification')->value('id')))->handle();

        $this->assertSame(1, NotificationEmail::query()->where('recipient', $admin->email)->count());
    }

    public function test_links_are_built_from_encoded_references_only(): void
    {
        $view = NotificationPresenter::present('order.confirmed', ['number' => '../../evil'], 'en');
        $this->assertSame('/account/orders/..%2F..%2Fevil', $view['url']);

        $this->assertNull(NotificationPresenter::present('no.such.type', [], 'en'));
    }
}
