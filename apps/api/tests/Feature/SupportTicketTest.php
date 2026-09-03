<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\Order;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Support ticket listings.
 *
 * These endpoints eager-load the ticket's order, but the model had no `order`
 * relation, so any listing threw RelationNotFoundException. It went unnoticed
 * because no environment had ever contained a ticket: the pages were only ever
 * seen empty, and an empty listing loads nothing.
 */
class SupportTicketTest extends TestCase
{
    use RefreshDatabase;

    private function ticketFor(User $user, ?Order $order = null): SupportTicket
    {
        return SupportTicket::query()->create([
            'reference' => 'TKT-'.strtoupper(substr(md5((string) $user->getKey()), 0, 8)),
            'user_id' => $user->getKey(),
            'name' => $user->name,
            'email' => $user->email,
            'subject' => 'Machine ID কোথায় পাব?',
            'category' => 'activation',
            'status' => 'open',
            'priority' => 'normal',
            'order_id' => $order?->getKey(),
        ]);
    }

    public function test_a_customer_can_list_their_tickets(): void
    {
        $user = $this->customer();
        $this->ticketFor($user);

        $this->actingAs($user)
            ->getJson('/api/v1/account/support-tickets')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_a_ticket_raised_from_an_order_reports_that_order(): void
    {
        $user = $this->customer();
        $order = Order::factory()->for($user)->paid()->create();
        $ticket = $this->ticketFor($user, $order);

        $this->actingAs($user)
            ->getJson('/api/v1/account/support-tickets/'.$ticket->reference)
            ->assertOk()
            ->assertJsonPath('data.order_number', $order->number);
    }

    public function test_one_customer_cannot_read_another_customers_ticket(): void
    {
        $owner = $this->customer();
        $other = $this->customer();
        $ticket = $this->ticketFor($owner);

        // Denied by policy rather than hidden: the caller is authenticated, so a
        // 403 tells them no more than a 404 would.
        $this->actingAs($other)
            ->getJson('/api/v1/account/support-tickets/'.$ticket->reference)
            ->assertStatus(403);
    }

    public function test_staff_can_list_tickets_for_moderation(): void
    {
        $user = $this->customer();
        $this->ticketFor($user);

        $this->actingAs($this->userWithRole(RoleEnum::Support))
            ->getJson('/api/v1/admin/support-tickets')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
