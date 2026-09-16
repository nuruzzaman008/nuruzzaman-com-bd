<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\Role;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Deleting orders from the dashboard: an order that never took money may go,
 * one that did is a financial record and stays.
 */
class OrderDeletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_abandoned_order_is_deleted_with_its_lines(): void
    {
        $order = Order::factory()->create(['status' => OrderStatus::PendingPayment]);
        $order->items()->create([
            'product_type' => 'course',
            'product_name' => 'Course',
            'variant_name' => 'Access',
            'sku' => 'C-1',
            'quantity' => 1,
            'unit_price_minor' => 500000,
            'line_total_minor' => 500000,
        ]);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->deleteJson('/api/v1/admin/orders/'.$order->number)->assertOk();

        $this->assertDatabaseMissing('orders', ['id' => $order->id]);
        $this->assertDatabaseMissing('order_items', ['order_id' => $order->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'order.deleted']);
    }

    public function test_a_paid_order_is_kept_as_a_financial_record(): void
    {
        $order = Order::factory()->paid()->create();
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $response = $this->deleteJson('/api/v1/admin/orders/'.$order->number)->assertStatus(409);

        $this->assertStringContainsString('financial record', (string) $response->json('error.message'));
        $this->assertDatabaseHas('orders', ['id' => $order->id]);
    }

    public function test_a_pending_order_with_a_payment_waiting_to_be_checked_is_kept(): void
    {
        // Money the customer says they sent counts, even before it is verified.
        $order = Order::factory()->create(['status' => OrderStatus::PendingPayment]);
        $order->payments()->create([
            'reference' => 'PAY-'.$order->number,
            'gateway' => 'manual',
            'status' => 'pending',
            'amount_minor' => $order->total_minor,
            'currency' => 'BDT',
        ]);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->deleteJson('/api/v1/admin/orders/'.$order->number)->assertStatus(409);
        $this->assertDatabaseHas('orders', ['id' => $order->id]);
    }

    public function test_only_someone_who_manages_orders_may_delete_one(): void
    {
        $order = Order::factory()->create(['status' => OrderStatus::Failed]);
        $this->actingAs($this->userWithRole(Role::Editor));

        $this->deleteJson('/api/v1/admin/orders/'.$order->number)->assertForbidden();
        $this->assertDatabaseHas('orders', ['id' => $order->id]);
    }
}
