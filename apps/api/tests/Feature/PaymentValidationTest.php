<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Jobs\FulfillOrder;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentEvent;
use App\Models\Price;
use App\Models\ProductVariant;
use App\Services\Payments\PaymentProcessor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class PaymentValidationTest extends TestCase
{
    use RefreshDatabase;

    private function orderWithPayment(int $amountMinor = 350000): Payment
    {
        $user = $this->customer();
        $variant = ProductVariant::factory()->create();
        Price::factory()->for($variant, 'variant')->amount($amountMinor)->create();

        $this->actingAs($user)->postJson('/api/v1/cart/items', ['variant_id' => $variant->id]);
        $this->actingAs($user)->postJson('/api/v1/checkout', [
            'name' => 'Rafiq Hasan',
            'email' => 'rafiq@example.com',
            'accepts_terms' => true,
            'accepts_privacy' => true,
            'accepts_refund_policy' => true,
        ])->assertCreated();

        return Payment::query()->firstOrFail();
    }

    private function ipnPayload(Payment $payment, array $overrides = []): array
    {
        return array_merge([
            'tran_id' => $payment->reference,
            'val_id' => 'SANDBOX-'.$payment->reference,
            'status' => 'VALID',
            'amount' => number_format($payment->amount_minor / 100, 2, '.', ''),
            'currency' => $payment->currency,
            'bank_tran_id' => 'BANK-'.$payment->reference,
            'risk_level' => '0',
        ], $overrides);
    }

    public function test_a_valid_ipn_marks_the_order_paid_and_queues_fulfilment(): void
    {
        Bus::fake();
        $payment = $this->orderWithPayment();

        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->ipnPayload($payment))
            ->assertOk()
            ->assertJsonPath('status', 'accepted');

        $this->assertSame(PaymentStatus::Validated, $payment->fresh()->status);
        $this->assertSame(OrderStatus::Paid, $payment->order->fresh()->status);
        Bus::assertDispatched(FulfillOrder::class);
    }

    public function test_a_tampered_amount_is_rejected(): void
    {
        $payment = $this->orderWithPayment(350000);

        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->ipnPayload($payment, ['amount' => '1.00']))
            ->assertOk()
            ->assertJsonPath('status', 'rejected');

        $this->assertNotSame(PaymentStatus::Validated, $payment->fresh()->status);
        $this->assertNotSame(OrderStatus::Paid, $payment->order->fresh()->status);
    }

    public function test_a_mismatched_currency_is_rejected(): void
    {
        $payment = $this->orderWithPayment();

        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->ipnPayload($payment, ['currency' => 'USD']))
            ->assertOk()
            ->assertJsonPath('status', 'rejected');

        // A currency the gateway did not settle in is treated as a failed
        // attempt, not as a payment we quietly accept.
        $this->assertSame(PaymentStatus::Failed, $payment->fresh()->status);
        $this->assertSame(OrderStatus::Failed, $payment->order->fresh()->status);
    }

    public function test_a_duplicate_ipn_is_stored_and_processed_once(): void
    {
        Bus::fake();
        $payment = $this->orderWithPayment();
        $callback = $this->ipnPayload($payment);

        $this->postJson('/api/v1/payments/sslcommerz/ipn', $callback)->assertOk();
        $this->postJson('/api/v1/payments/sslcommerz/ipn', $callback)->assertOk();
        $this->postJson('/api/v1/payments/sslcommerz/ipn', $callback)->assertOk();

        $this->assertSame(1, PaymentEvent::query()->count());
        Bus::assertDispatchedTimes(FulfillOrder::class, 1);
    }

    public function test_a_failed_callback_fails_the_order(): void
    {
        $payment = $this->orderWithPayment();

        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->ipnPayload($payment, ['status' => 'FAILED']))
            ->assertOk();

        $this->assertSame(PaymentStatus::Failed, $payment->fresh()->status);
        $this->assertSame(OrderStatus::Failed, $payment->order->fresh()->status);
    }

    public function test_a_late_failure_callback_cannot_undo_a_settled_payment(): void
    {
        Bus::fake();
        $payment = $this->orderWithPayment();

        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->ipnPayload($payment))->assertOk();
        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->ipnPayload($payment, [
            'status' => 'FAILED',
            'val_id' => 'LATE-'.$payment->reference,
        ]))->assertOk();

        $this->assertSame(PaymentStatus::Validated, $payment->fresh()->status);
        $this->assertSame(OrderStatus::Paid, $payment->order->fresh()->status);
    }

    public function test_a_risky_payment_is_held_for_manual_review(): void
    {
        Bus::fake();
        config()->set('nb.commerce.risk_order_policy', 'manual_hold');
        $payment = $this->orderWithPayment();

        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->ipnPayload($payment, [
            'risk_level' => '1',
            'risk_title' => 'High risk',
        ]))->assertOk();

        $this->assertSame(PaymentStatus::RiskHold, $payment->fresh()->status);
        $this->assertSame(OrderStatus::PendingPayment, $payment->order->fresh()->status);
        Bus::assertNotDispatched(FulfillOrder::class);
    }

    public function test_a_callback_for_an_unknown_reference_is_recorded_and_ignored(): void
    {
        $this->postJson('/api/v1/payments/sslcommerz/ipn', [
            'tran_id' => 'PAY-DOES-NOT-EXIST',
            'val_id' => 'X',
            'status' => 'VALID',
        ])->assertOk()->assertJsonPath('status', 'rejected');

        $this->assertSame(0, Order::query()->where('status', OrderStatus::Paid->value)->count());
    }

    public function test_the_return_url_alone_does_not_settle_an_order(): void
    {
        $payment = $this->orderWithPayment();

        $this->actingAs($payment->order->user)
            ->getJson('/api/v1/payments/'.$payment->reference.'/status')
            ->assertOk()
            ->assertJsonPath('data.is_settled', false)
            ->assertJsonPath('data.order_status', 'pending_payment');
    }

    public function test_a_customer_cannot_read_another_customers_payment_status(): void
    {
        $payment = $this->orderWithPayment();
        $other = $this->customer();

        $this->actingAs($other)
            ->getJson('/api/v1/payments/'.$payment->reference.'/status')
            ->assertStatus(403);
    }
}
