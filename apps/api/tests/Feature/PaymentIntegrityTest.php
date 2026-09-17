<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\RefundStatus;
use App\Enums\Role as RoleEnum;
use App\Jobs\FulfillOrder;
use App\Jobs\ProcessRefund;
use App\Jobs\ReconcilePayments;
use App\Models\Cart;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentEvent;
use App\Models\Price;
use App\Models\ProductVariant;
use App\Models\Refund;
use App\Models\User;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Fulfillment\RevocationService;
use App\Services\Payments\FakeGateway;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\PaymentProcessor;
use App\Services\Payments\SslCommerzGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * The payment audit of 17 September 2026 (P1-P6): who may fail a payment, a
 * settled payment reported again, manual payments and the reconciler, refund
 * limits and routing, and coupon limits.
 */
class PaymentIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private const STORE_PASSWORD = 'sandbox-store-password';

    private function orderWithPayment(int $amountMinor = 350000): Payment
    {
        [$user] = $this->cartWithItem($amountMinor);
        $this->actingAs($user)->postJson('/api/v1/checkout', $this->checkoutPayload())->assertCreated();

        return app(PaymentProcessor::class)->startPayment(Order::query()->latest('id')->firstOrFail())['payment'];
    }

    /** @return array{0: User, 1: ProductVariant} */
    private function cartWithItem(int $amountMinor = 350000, ?User $user = null, ?ProductVariant $variant = null): array
    {
        $user ??= $this->customer();

        if (! $variant) {
            $variant = ProductVariant::factory()->create();
            Price::factory()->for($variant, 'variant')->amount($amountMinor)->create();
        }

        $this->actingAs($user)->postJson('/api/v1/cart/items', ['variant_id' => $variant->id])->assertCreated();

        return [$user, $variant];
    }

    private function checkoutPayload(): array
    {
        return [
            'name' => 'Rafiq Hasan',
            'email' => 'rafiq@example.com',
            'accepts_terms' => true,
            'accepts_privacy' => true,
            'accepts_refund_policy' => true,
        ];
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

    /** A card payment verified against SSLCOMMERZ itself, with the HTTP layer faked. */
    private function useRealGateway(array $validationAnswer = []): void
    {
        config([
            'sslcommerz.mode' => 'sandbox',
            'sslcommerz.sandbox.store_id' => 'teststore',
            'sslcommerz.sandbox.store_password' => self::STORE_PASSWORD,
        ]);

        Http::fake(['*' => Http::response($validationAnswer ?: ['status' => 'INVALID_TRANSACTION'])]);

        $this->app->instance(PaymentGateway::class, new SslCommerzGateway);
    }

    private function cardPayment(): Payment
    {
        $order = Order::factory()->create(['total_minor' => 350000]);

        return Payment::create([
            'order_id' => $order->id,
            'gateway' => 'sslcommerz',
            'reference' => 'PAY-260917000000-VICTIM',
            'status' => PaymentStatus::Pending,
            'currency' => 'BDT',
            'amount_minor' => 350000,
        ]);
    }

    /** Signs a callback the way SSLCOMMERZ does. */
    private function signed(array $payload, string $password = self::STORE_PASSWORD, ?array $keys = null): array
    {
        $keys ??= array_keys($payload);
        $fields = array_intersect_key($payload, array_flip($keys));
        $fields['store_passwd'] = md5($password);
        ksort($fields);

        $pairs = [];

        foreach ($fields as $key => $value) {
            $pairs[] = $key.'='.$value;
        }

        return $payload + ['verify_key' => implode(',', $keys), 'verify_sign' => md5(implode('&', $pairs))];
    }

    // ------------------------------------------------------------ P2: failures

    public function test_a_failure_callback_nobody_could_verify_changes_nothing(): void
    {
        $payment = $this->orderWithPayment();

        $this->postJson('/api/v1/payments/sslcommerz/ipn', [
            'tran_id' => $payment->reference,
            'status' => 'FAILED',
        ])->assertOk()->assertJsonPath('status', 'rejected');

        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
        $this->assertSame(OrderStatus::PendingPayment, $payment->order->fresh()->status);
        $this->assertStringStartsWith('Not confirmed by the gateway', PaymentEvent::query()->firstOrFail()->validation_error);
    }

    public function test_someone_elses_val_id_cannot_fail_a_payment(): void
    {
        // The attacker's own genuine transaction, validated by the gateway.
        $this->useRealGateway(['status' => 'VALID', 'tran_id' => 'PAY-ATTACKERS-OWN', 'amount' => '10.00', 'currency_type' => 'BDT']);
        $payment = $this->cardPayment();

        $this->postJson('/api/v1/payments/sslcommerz/ipn', [
            'tran_id' => $payment->reference,
            'val_id' => 'attackers-val-id',
            'status' => 'FAILED',
        ])->assertOk();

        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
        $this->assertSame(OrderStatus::PendingPayment, $payment->order->fresh()->status);
    }

    public function test_a_failure_signed_by_the_gateway_is_recorded(): void
    {
        $this->useRealGateway();
        $payment = $this->cardPayment();

        // An empty field inside the signature must reach the check untouched.
        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->signed([
            'tran_id' => $payment->reference,
            'status' => 'FAILED',
            'card_brand' => '',
            'error' => 'Declined by issuer ',
        ]))->assertOk();

        $this->assertSame(PaymentStatus::Failed, $payment->fresh()->status);
        $this->assertSame(OrderStatus::Failed, $payment->order->fresh()->status);
    }

    public function test_a_forged_or_retargeted_signature_is_not_believed(): void
    {
        $this->useRealGateway();
        $payment = $this->cardPayment();

        // Signed with the wrong store password.
        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->signed([
            'tran_id' => $payment->reference,
            'status' => 'FAILED',
        ], 'guessed-password'))->assertOk();

        // A genuine signature that does not cover the transaction reference.
        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->signed([
            'tran_id' => $payment->reference,
            'status' => 'CANCELLED',
            'val_id' => 'X1',
        ], keys: ['status', 'val_id']))->assertOk();

        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
        $this->assertSame(OrderStatus::PendingPayment, $payment->order->fresh()->status);
    }

    public function test_a_payment_on_risk_hold_is_not_failed_by_a_later_callback(): void
    {
        Bus::fake();
        config()->set('nb.commerce.risk_order_policy', 'manual_hold');
        $payment = $this->orderWithPayment();

        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->ipnPayload($payment, ['risk_level' => '1']))->assertOk();
        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->ipnPayload($payment, [
            'status' => 'FAILED',
            'val_id' => 'LATE-'.$payment->reference,
        ]))->assertOk();

        $this->assertSame(PaymentStatus::RiskHold, $payment->fresh()->status);
        $this->assertSame(OrderStatus::PendingPayment, $payment->order->fresh()->status);
    }

    // ------------------------------------------------------ P3: settled stays

    public function test_a_settled_payment_is_not_rewritten_when_reported_again(): void
    {
        Bus::fake();
        $payment = $this->orderWithPayment();

        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->ipnPayload($payment))->assertOk();
        $settled = $payment->fresh();

        // Same transaction, new fingerprint.
        $this->postJson('/api/v1/payments/sslcommerz/ipn', $this->ipnPayload($payment, [
            'bank_tran_id' => 'REPLAYED-'.$payment->reference,
        ]))->assertOk();

        $this->assertSame(2, PaymentEvent::query()->count());
        $this->assertSame($settled->bank_transaction_id, $payment->fresh()->bank_transaction_id);
        $this->assertSame(PaymentStatus::Validated, $payment->fresh()->status);
        Bus::assertDispatchedTimes(FulfillOrder::class, 1);
    }

    // ------------------------------------------------- P4: manual and reconcile

    public function test_reconciliation_leaves_a_manual_payment_waiting_for_review(): void
    {
        $manual = Payment::create([
            'order_id' => Order::factory()->create()->id,
            'gateway' => 'manual',
            'reference' => 'PAY-MANUAL-OLD',
            'status' => PaymentStatus::Pending,
            'currency' => 'BDT',
            'amount_minor' => 500000,
        ]);
        $abandoned = Payment::create([
            'order_id' => Order::factory()->create()->id,
            'gateway' => 'sslcommerz',
            'reference' => 'PAY-CARD-OLD',
            'status' => PaymentStatus::Pending,
            'currency' => 'BDT',
            'amount_minor' => 500000,
        ]);
        $manual->forceFill(['created_at' => now()->subDays(2)])->save();
        $abandoned->forceFill(['created_at' => now()->subDays(2)])->save();

        (new ReconcilePayments)->handle(app(PaymentProcessor::class));

        $this->assertSame(PaymentStatus::Pending, $manual->fresh()->status);
        $this->assertSame(PaymentStatus::Failed, $abandoned->fresh()->status);
    }

    // --------------------------------------------------------- P5, P6: refunds

    public function test_refund_requests_cannot_add_up_past_the_order_total(): void
    {
        $order = Order::factory()->for($this->customer())->paid()->create(['total_minor' => 100000]);
        $admin = $this->userWithRole(RoleEnum::Admin);
        $url = '/api/v1/admin/orders/'.$order->number.'/refunds';

        $this->actingAs($admin)->postJson($url, ['amount_minor' => 60000, 'reason' => 'Part one'])->assertCreated();
        $this->actingAs($admin)->postJson($url, ['amount_minor' => 50000, 'reason' => 'Too much'])->assertStatus(422);
        $this->actingAs($admin)->postJson($url, ['amount_minor' => 40000, 'reason' => 'The rest'])->assertCreated();

        $this->assertSame(100000, (int) Refund::query()->sum('amount_minor'));
    }

    public function test_an_unpaid_order_cannot_be_refunded(): void
    {
        $order = Order::factory()->for($this->customer())->create(['total_minor' => 100000]);

        $this->actingAs($this->userWithRole(RoleEnum::Admin))
            ->postJson('/api/v1/admin/orders/'.$order->number.'/refunds', ['amount_minor' => 1000, 'reason' => 'Nothing was paid'])
            ->assertStatus(409);

        $this->assertSame(0, Refund::query()->count());
    }

    public function test_a_manual_payment_is_refunded_without_the_card_gateway(): void
    {
        $order = Order::factory()->for($this->customer())->create([
            'status' => OrderStatus::RefundPending,
            'total_minor' => 100000,
            'paid_at' => now(),
        ]);
        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'manual',
            'reference' => 'PAY-MANUAL-PAID',
            'status' => PaymentStatus::Validated,
            'currency' => 'BDT',
            'amount_minor' => 100000,
            'bank_transaction_id' => 'BKASH123456',
        ]);
        $refund = Refund::create([
            'order_id' => $order->id,
            'payment_id' => $payment->id,
            'status' => RefundStatus::Approved,
            'amount_minor' => 100000,
            'reason' => 'Returned by bKash',
            'revoke_entitlements' => false,
        ]);

        $gateway = $this->mock(PaymentGateway::class);
        $gateway->shouldNotReceive('refund');

        (new ProcessRefund($refund->id))->handle($gateway, app(OrderStateMachine::class), app(RevocationService::class));

        $this->assertSame(RefundStatus::Processed, $refund->fresh()->status);
        $this->assertNull($refund->fresh()->gateway_refund_id);
        $this->assertSame(OrderStatus::Refunded, $order->fresh()->status);
    }

    public function test_the_sandbox_gateway_refunds_nothing_in_production(): void
    {
        $this->app['env'] = 'production';

        $result = (new FakeGateway)->refund(new Payment(['reference' => 'PAY-1', 'amount_minor' => 1000, 'currency' => 'BDT']), 1000, 'Test');

        $this->assertFalse($result->accepted);
    }

    // ------------------------------------------------------------ P1: coupons

    public function test_a_one_per_customer_coupon_cannot_be_used_on_a_second_order(): void
    {
        Coupon::create(['code' => 'ONCE10', 'discount_type' => 'percent', 'discount_value' => 10, 'is_active' => true]);
        [$user, $variant] = $this->cartWithItem();

        $this->actingAs($user)->postJson('/api/v1/cart/coupon', ['code' => 'ONCE10'])->assertOk();
        $this->actingAs($user)->postJson('/api/v1/checkout', $this->checkoutPayload())->assertCreated();

        // The first order is still waiting for payment: that already uses it.
        $this->cartWithItem(user: $user, variant: $variant);
        $this->actingAs($user)->postJson('/api/v1/cart/coupon', ['code' => 'ONCE10'])
            ->assertStatus(422)
            ->assertJsonPath('error.message', 'You have already used this coupon.');

        // Nor can it be carried into checkout some other way.
        $cart = Cart::query()->where('user_id', $user->id)->where('status', 'open')->firstOrFail();
        $cart->update(['coupon_id' => Coupon::query()->value('id')]);
        $this->actingAs($user)->postJson('/api/v1/checkout', $this->checkoutPayload())->assertStatus(422);

        $this->assertSame(1, Order::query()->count());
    }

    public function test_a_failed_order_gives_its_coupon_use_back(): void
    {
        Coupon::create(['code' => 'ONCE10', 'discount_type' => 'percent', 'discount_value' => 10, 'is_active' => true]);
        [$user, $variant] = $this->cartWithItem();

        $this->actingAs($user)->postJson('/api/v1/cart/coupon', ['code' => 'ONCE10'])->assertOk();
        $this->actingAs($user)->postJson('/api/v1/checkout', $this->checkoutPayload())->assertCreated();
        app(OrderStateMachine::class)->transition(Order::query()->firstOrFail(), OrderStatus::Failed, 'Payment failed');

        $this->cartWithItem(user: $user, variant: $variant);
        $this->actingAs($user)->postJson('/api/v1/cart/coupon', ['code' => 'ONCE10'])->assertOk();
        $this->actingAs($user)->postJson('/api/v1/checkout', $this->checkoutPayload())->assertCreated();
    }

    public function test_the_total_limit_counts_every_customers_orders(): void
    {
        Coupon::create([
            'code' => 'FIRST1', 'discount_type' => 'percent', 'discount_value' => 10, 'is_active' => true,
            'max_redemptions' => 1, 'max_redemptions_per_user' => 5,
        ]);
        [$first, $variant] = $this->cartWithItem();

        $this->actingAs($first)->postJson('/api/v1/cart/coupon', ['code' => 'FIRST1'])->assertOk();
        $this->actingAs($first)->postJson('/api/v1/checkout', $this->checkoutPayload())->assertCreated();

        [$second] = $this->cartWithItem(variant: $variant);
        $this->actingAs($second)->postJson('/api/v1/cart/coupon', ['code' => 'FIRST1'])
            ->assertStatus(422)
            ->assertJsonPath('error.message', 'This coupon has reached its redemption limit.');

        $this->actingAs($this->userWithRole(RoleEnum::Admin))
            ->getJson('/api/v1/admin/coupons')
            ->assertOk()
            ->assertJsonPath('data.data.0.redemptions_count', 1);
    }
}
