<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Post;
use App\Models\SupportTicket;
use App\Models\User;
use App\Support\Reference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * "Needs attention" on the dashboard and "still to do" in the bell count the
 * same work, and only work that is waiting on us.
 */
class AttentionCountsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Mail::fake();
    }

    private function ticket(User $customer): SupportTicket
    {
        $ticket = SupportTicket::query()->create([
            'reference' => 'TCK-'.fake()->unique()->numerify('####'), 'user_id' => $customer->id,
            'name' => 'Karim', 'email' => $customer->email, 'mobile' => '01711000000',
            'subject' => 'Licence not activating', 'category' => 'licence', 'status' => 'open',
        ]);
        $ticket->messages()->create(['author_id' => $customer->id, 'author_kind' => 'customer', 'body' => 'It says invalid code.']);

        return $ticket;
    }

    private function ticketCounts(User $staff): array
    {
        $dashboard = $this->actingAs($staff)->getJson('/api/v1/admin/dashboard')->assertOk()->json('data.attention.support_tickets_open');
        $bell = collect($this->actingAs($staff)->getJson('/api/v1/admin/notifications/feed')->assertOk()->json('meta.pending'))
            ->pluck('count', 'key')->get('tickets');

        return [$dashboard, $bell];
    }

    public function test_answering_a_ticket_takes_it_off_both_counts_until_the_customer_writes_again(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $customer = $this->customer();
        $first = $this->ticket($customer);
        $this->ticket($customer);

        $this->assertSame([2, 2], $this->ticketCounts($admin));

        $this->actingAs($admin)->postJson("/api/v1/admin/support-tickets/{$first->reference}/replies", ['message' => 'Please send a photo of the error.'])
            ->assertOk();
        $this->assertSame('pending', $first->fresh()->status->value);
        $this->assertSame([1, 1], $this->ticketCounts($admin));

        // An internal note is not an answer.
        $second = SupportTicket::query()->whereKeyNot($first->id)->sole();
        $this->actingAs($admin)->postJson("/api/v1/admin/support-tickets/{$second->reference}/replies", ['message' => 'Checking the licence server.', 'is_internal' => true])
            ->assertOk();
        $this->assertSame([1, 1], $this->ticketCounts($admin));

        // The customer answers back: waiting on us again.
        $this->actingAs($customer)->postJson("/api/v1/account/support-tickets/{$first->reference}/replies", ['message' => 'Here is the photo.'])
            ->assertSuccessful();
        $this->assertSame([2, 2], $this->ticketCounts($admin));
    }

    public function test_the_bell_also_carries_risky_payments_and_articles_awaiting_review(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $order = Order::factory()->for($this->customer())->create();
        Payment::query()->create([
            'order_id' => $order->id, 'gateway' => 'manual', 'reference' => Reference::payment(),
            'status' => 'risk_hold', 'currency' => 'BDT', 'amount_minor' => 100_000,
        ]);
        Post::factory()->create(['status' => 'in_review']);
        Post::factory()->create(['status' => 'in_review']);

        $dashboard = $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertOk()->json('data.attention');
        $bell = collect($this->actingAs($admin)->getJson('/api/v1/admin/notifications/feed')->assertOk()->json('meta.pending'))
            ->keyBy('key');

        $this->assertSame($dashboard['payments_on_risk_hold'], $bell['risky_payments']['count']);
        $this->assertSame(1, $bell['risky_payments']['count']);
        $this->assertSame($dashboard['posts_in_review'], $bell['reviews']['count']);
        $this->assertSame(2, $bell['reviews']['count']);
        $this->assertSame('/dashboard/posts?status=in_review', $bell['reviews']['url']);

        // Each row goes only to staff who can act on it.
        $support = collect($this->actingAs($this->userWithRole(RoleEnum::Support))->getJson('/api/v1/admin/notifications/feed')->json('meta.pending'))
            ->pluck('key')->all();
        $this->assertNotContains('reviews', $support);
        $this->assertNotContains('risky_payments', $support);
    }
}
