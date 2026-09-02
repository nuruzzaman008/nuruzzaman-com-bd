<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\RefundStatus;
use App\Enums\Role as RoleEnum;
use App\Jobs\ProcessRefund;
use App\Models\DownloadAsset;
use App\Models\DownloadEntitlement;
use App\Models\Order;
use App\Models\Refund;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefundTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_refund_needs_a_request_and_then_an_approval(): void
    {
        $customer = $this->customer();
        $order = Order::factory()->for($customer)->paid()->create(['total_minor' => 500000]);
        $admin = $this->userWithRole(RoleEnum::Admin);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/orders/'.$order->number.'/refunds', [
                'amount_minor' => 500000,
                'reason' => 'Duplicate purchase',
            ])
            ->assertCreated();

        $refund = Refund::query()->firstOrFail();

        $this->assertSame(RefundStatus::Requested, $refund->status);
        $this->assertSame(OrderStatus::RefundPending, $order->fresh()->status);
    }

    public function test_a_refund_cannot_exceed_the_remaining_order_total(): void
    {
        $customer = $this->customer();
        $order = Order::factory()->for($customer)->paid()->create(['total_minor' => 100000]);
        $admin = $this->userWithRole(RoleEnum::Admin);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/orders/'.$order->number.'/refunds', [
                'amount_minor' => 100001,
                'reason' => 'Too much',
            ])
            ->assertStatus(422);
    }

    public function test_processing_a_refund_revokes_entitlements(): void
    {
        $customer = $this->customer();
        // An approved refund always sits on an order that is already in the
        // refund_pending state, which is what RefundController::store does.
        $order = Order::factory()->for($customer)->create([
            'status' => OrderStatus::RefundPending,
            'total_minor' => 100000,
            'paid_at' => now(),
        ]);

        $asset = DownloadAsset::create([
            'slug' => 'installer', 'name' => 'Installer', 'disk' => 'private',
            'storage_path' => 'releases/installer.exe', 'is_available' => true,
        ]);

        $entitlement = DownloadEntitlement::create([
            'user_id' => $customer->getKey(),
            'download_asset_id' => $asset->getKey(),
            'order_id' => $order->getKey(),
        ]);

        $refund = Refund::create([
            'order_id' => $order->getKey(),
            'status' => RefundStatus::Approved,
            'amount_minor' => 100000,
            'reason' => 'Refunded',
            'revoke_entitlements' => true,
        ]);

        app(ProcessRefund::class, ['refundId' => $refund->getKey()])->handle(
            app(\App\Services\Payments\PaymentGateway::class),
            app(\App\Services\Commerce\OrderStateMachine::class),
            app(\App\Services\Fulfillment\RevocationService::class),
        );

        $this->assertSame(RefundStatus::Processed, $refund->fresh()->status);
        $this->assertSame(OrderStatus::Refunded, $order->fresh()->status);
        $this->assertNotNull($entitlement->fresh()->revoked_at);
    }

    public function test_a_rejected_refund_returns_the_order_to_its_previous_state(): void
    {
        $customer = $this->customer();
        $order = Order::factory()->for($customer)->create([
            'status' => OrderStatus::RefundPending,
            'total_minor' => 100000,
            'paid_at' => now(),
        ]);

        $refund = Refund::create([
            'order_id' => $order->getKey(),
            'status' => RefundStatus::Requested,
            'amount_minor' => 100000,
        ]);

        $admin = $this->userWithRole(RoleEnum::Admin);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/refunds/'.$refund->id.'/reject')
            ->assertOk();

        $this->assertSame(OrderStatus::Paid, $order->fresh()->status);
    }

    public function test_support_staff_cannot_approve_a_refund(): void
    {
        $customer = $this->customer();
        $order = Order::factory()->for($customer)->paid()->create();
        $support = $this->userWithRole(RoleEnum::Support);

        $this->actingAs($support)
            ->postJson('/api/v1/admin/orders/'.$order->number.'/refunds', [
                'amount_minor' => 1000,
                'reason' => 'Trying',
            ])
            ->assertStatus(403);
    }
}
