<?php

namespace Tests\Feature;

use App\Enums\ActivationRequestStatus;
use App\Enums\OrderStatus;
use App\Enums\Role as RoleEnum;
use App\Models\ActivationRequest;
use App\Models\Order;
use App\Models\User;
use App\Support\MachineIdentifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ActivationRequestTest extends TestCase
{
    use RefreshDatabase;

    private const MACHINE_ID = 'A1B2-C3D4-E5F6-9F3C';

    private function paidOrderFor(User $user): Order
    {
        return Order::factory()->for($user)->paid()->create();
    }

    public function test_a_customer_can_submit_a_request_against_their_own_paid_order(): void
    {
        $user = $this->customer();
        $order = $this->paidOrderFor($user);

        $this->actingAs($user)
            ->postJson('/api/v1/account/activation-requests', [
                'order_number' => $order->number,
                'machine_id' => self::MACHINE_ID,
                'autocad_version' => '2025',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'submitted');

        $request = ActivationRequest::query()->firstOrFail();

        $this->assertSame(MachineIdentifier::fingerprint(self::MACHINE_ID), $request->machine_id_fingerprint);
        $this->assertSame(self::MACHINE_ID, $request->machine_id_encrypted);
    }

    public function test_the_machine_id_is_never_returned_in_full(): void
    {
        $user = $this->customer();
        $order = $this->paidOrderFor($user);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/account/activation-requests', [
                'order_number' => $order->number,
                'machine_id' => self::MACHINE_ID,
            ])
            ->assertCreated();

        $this->assertStringNotContainsString('C3D4', $response->getContent());
        $response->assertJsonPath('data.machine_id_masked', MachineIdentifier::mask(self::MACHINE_ID));
    }

    public function test_a_request_cannot_be_attached_to_someone_elses_order(): void
    {
        $owner = $this->customer();
        $intruder = $this->customer();
        $order = $this->paidOrderFor($owner);

        $this->actingAs($intruder)
            ->postJson('/api/v1/account/activation-requests', [
                'order_number' => $order->number,
                'machine_id' => self::MACHINE_ID,
            ])
            ->assertStatus(403);
    }

    public function test_an_unpaid_order_cannot_be_activated(): void
    {
        $user = $this->customer();
        $order = Order::factory()->for($user)->create(['status' => OrderStatus::PendingPayment]);

        $this->actingAs($user)
            ->postJson('/api/v1/account/activation-requests', [
                'order_number' => $order->number,
                'machine_id' => self::MACHINE_ID,
            ])
            ->assertStatus(422);
    }

    public function test_a_second_open_request_for_the_same_machine_is_a_conflict(): void
    {
        $user = $this->customer();
        $order = $this->paidOrderFor($user);
        $payload = ['order_number' => $order->number, 'machine_id' => self::MACHINE_ID];

        $this->actingAs($user)->postJson('/api/v1/account/activation-requests', $payload)->assertCreated();
        $this->actingAs($user)->postJson('/api/v1/account/activation-requests', $payload)->assertStatus(409);
    }

    public function test_a_recovery_file_upload_is_rejected(): void
    {
        $user = $this->customer();
        $order = $this->paidOrderFor($user);

        $this->actingAs($user)
            ->postJson('/api/v1/account/activation-requests', [
                'order_number' => $order->number,
                'machine_id' => self::MACHINE_ID,
                'recovery_file' => 'anything',
            ])
            ->assertCreated();

        $this->assertDatabaseMissing('activation_requests', ['customer_note' => 'anything']);
    }

    public function test_only_support_staff_can_review_a_request(): void
    {
        $user = $this->customer();
        $order = $this->paidOrderFor($user);
        $reference = $this->actingAs($user)
            ->postJson('/api/v1/account/activation-requests', [
                'order_number' => $order->number,
                'machine_id' => self::MACHINE_ID,
            ])->json('data.reference');

        $this->actingAs($user)
            ->getJson('/api/v1/admin/activation-requests')
            ->assertStatus(403);

        Mail::fake();
        $support = $this->userWithRole(RoleEnum::Support);

        $this->actingAs($support)
            ->postJson('/api/v1/admin/activation-requests/'.$reference.'/transition', [
                'status' => 'under_review',
                'note' => 'Picked up',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'under_review');
    }

    public function test_an_illegal_status_jump_is_refused(): void
    {
        $user = $this->customer();
        $order = $this->paidOrderFor($user);
        $reference = $this->actingAs($user)
            ->postJson('/api/v1/account/activation-requests', [
                'order_number' => $order->number,
                'machine_id' => self::MACHINE_ID,
            ])->json('data.reference');

        $support = $this->userWithRole(RoleEnum::Support);

        // submitted -> completed is not a legal transition.
        $this->actingAs($support)
            ->postJson('/api/v1/admin/activation-requests/'.$reference.'/transition', [
                'status' => ActivationRequestStatus::Completed->value,
            ])
            ->assertStatus(409);
    }
}
