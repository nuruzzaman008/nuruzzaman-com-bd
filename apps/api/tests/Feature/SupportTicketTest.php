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

    public function test_ticket_creation_requires_name_and_valid_mobile(): void
    {
        $this->actingAs($this->customer());
        $payload = ['subject' => 'Installation help', 'category' => 'installation', 'message' => 'Please help with installing the software.'];
        $this->postJson('/api/v1/account/support-tickets', $payload)->assertUnprocessable();
        $this->postJson('/api/v1/account/support-tickets', $payload + ['name' => 'Test Buyer', 'mobile' => 'invalid'])->assertUnprocessable();
        $this->postJson('/api/v1/account/support-tickets', $payload + ['name' => 'Test Buyer', 'mobile' => '01712345678'])->assertCreated()->assertJsonPath('data.name', 'Test Buyer')->assertJsonPath('data.mobile', '01712345678')->assertJsonCount(1, 'data.messages');
        $this->assertDatabaseCount('support_tickets', 1);
    }

    public function test_admin_and_owner_can_reply_while_internal_notes_stay_private(): void
    {
        $owner = $this->customer();
        $ticket = $this->ticketFor($owner);
        $adminUrl = '/api/v1/admin/support-tickets/'.$ticket->reference;
        $userUrl = '/api/v1/account/support-tickets/'.$ticket->reference;
        $this->actingAs($this->userWithRole(RoleEnum::SuperAdmin));
        $this->postJson($adminUrl.'/replies', ['message' => 'Please restart AutoCAD.'])->assertOk()->assertJsonPath('data.status', 'pending');
        $this->postJson($adminUrl.'/replies', ['message' => 'Private investigation details', 'is_internal' => true])->assertOk()->assertJsonCount(2, 'data.messages');
        $this->actingAs($owner)->getJson($userUrl)->assertOk()->assertJsonCount(1, 'data.messages')->assertJsonMissing(['body' => 'Private investigation details']);
        $this->postJson($userUrl.'/replies', ['message' => 'I restarted, please check again.', 'is_internal' => true])->assertOk()->assertJsonPath('data.status', 'open')->assertJsonPath('data.messages.1.author_kind', 'customer')->assertJsonPath('data.messages.1.is_internal', false);
        $this->actingAs($this->userWithRole(RoleEnum::SuperAdmin))->patchJson($adminUrl, ['status' => 'resolved'])->assertOk();
        $this->actingAs($owner)->postJson($userUrl.'/replies', ['message' => 'Still need assistance.'])->assertOk()->assertJsonPath('data.status', 'open')->assertJsonPath('data.resolved_at', null);
        $count = $ticket->messages()->count();
        $this->actingAs($this->customer())->postJson($userUrl.'/replies', ['message' => 'Unauthorized reply'])->assertForbidden();
        $this->postJson($adminUrl.'/replies', ['message' => 'Unauthorized staff reply'])->assertForbidden();
        $this->assertSame($count, $ticket->messages()->count());
    }
}
