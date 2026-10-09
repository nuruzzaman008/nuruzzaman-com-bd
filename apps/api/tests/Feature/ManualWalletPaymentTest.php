<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\ProductType;
use App\Enums\Role;
use App\Jobs\FulfillOrder;
use App\Jobs\SendOrderReceipt;
use App\Mail\OrderReceiptMail;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Price;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SoftwareLicense;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Fulfillment\FulfillmentService;
use App\Services\Licensing\OnlineLicensingService;
use App\Services\Licensing\OnlineWalletService;
use App\Services\Payments\ManualWalletCredit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Tests\TestCase;

class ManualWalletPaymentTest extends TestCase
{
    use RefreshDatabase;

    private function scenario(bool $wallet = true): array
    {
        Bus::fake();
        $user = $this->customer();
        $purchase = Order::factory()->for($user)->paid()->create();
        $item = $purchase->items()->create(['product_type' => 'software_license', 'product_name' => 'Tools', 'variant_name' => 'Single', 'sku' => 'NBET-V6-SINGLE', 'quantity' => 1, 'unit_price_minor' => 100, 'line_total_minor' => 100]);
        $license = SoftwareLicense::create(['license_code' => 'NB-'.Str::uuid(), 'user_id' => $user->id, 'order_id' => $purchase->id, 'order_item_id' => $item->id, 'product_name' => 'Tools', 'status' => 'issued', 'device_limit' => 1, 'issued_at' => now()]);
        if ($wallet) {
            DB::table('nb_online_wallets')->insert(['software_license_id' => $license->id, 'balance' => 100, 'reserved_balance' => 20, 'created_at' => now()->subDay(), 'updated_at' => now()]);
        }
        $order = Order::factory()->for($user)->create();
        $order->items()->create(['product_type' => 'credit_refill', 'product_name' => 'Tokens', 'variant_name' => 'Refill', 'sku' => 'TOKENS', 'quantity' => 2, 'unit_price_minor' => $order->total_minor, 'line_total_minor' => $order->total_minor, 'fulfillment_meta' => ['credit_amount' => 500]]);
        $payment = Payment::create(['order_id' => $order->id, 'gateway' => 'manual', 'reference' => 'PAY-'.Str::uuid(), 'status' => 'pending', 'currency' => $order->currency, 'amount_minor' => $order->total_minor]);
        $submission = DB::table('manual_payment_submissions')->insertGetId(['order_id' => $order->id, 'payment_id' => $payment->id, 'method' => 'bkash', 'transaction_id' => 'TX-'.Str::uuid(), 'sender' => 'TEST', 'recipient' => 'TEST', 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        $admin = $this->userWithRole(Role::Admin);
        $this->actingAs($admin);

        return [$order, $payment, $submission, $license, $admin];
    }

    public function test_checkout_targets_selected_wallet_and_approval_notifies_and_credits_exactly_once(): void
    {
        [, , , $first, $admin] = $this->scenario();
        [, , , $second] = $this->scenario();
        $second->update(['user_id' => $first->user_id]);
        $second->order->update(['user_id' => $first->user_id]);
        $this->actingAs($first->user);
        $variant = ProductVariant::factory()->create([
            'product_id' => Product::factory()->ofType(ProductType::CreditRefill), 'credit_amount' => 500,
        ]);
        Price::factory()->for($variant, 'variant')->amount(10000)->create();
        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])->assertCreated();
        $payload = ['name' => 'Test Customer', 'email' => $first->user->email, 'accepts_terms' => true, 'accepts_privacy' => true, 'accepts_refund_policy' => true];
        $this->postJson('/api/v1/checkout', $payload)->assertUnprocessable()->assertJsonValidationErrors('wallet_license_code', 'error.fields');
        $this->postJson('/api/v1/checkout', [...$payload, 'wallet_license_code' => 'NB-NOT-MINE'])->assertUnprocessable();
        $response = $this->withHeader('Idempotency-Key', 'selected-wallet-checkout')->postJson('/api/v1/checkout', [...$payload, 'wallet_license_code' => $second->license_code])->assertCreated();
        $order = Order::where('number', $response->json('data.order.number'))->firstOrFail();
        $this->assertDatabaseHas('refill_orders', ['order_id' => $order->id, 'software_license_id' => $second->id, 'credit_amount' => 500]);
        $this->assertSame(10000, $order->total_minor);
        $this->assertSame($second->license_code, $order->items->first()->fulfillment_meta['wallet_license_code']);
        $payment = Payment::create(['order_id' => $order->id, 'gateway' => 'manual', 'reference' => 'PAY-'.Str::uuid(), 'status' => 'pending', 'currency' => $order->currency, 'amount_minor' => $order->total_minor]);
        $id = DB::table('manual_payment_submissions')->insertGetId(['order_id' => $order->id, 'payment_id' => $payment->id, 'method' => 'bkash', 'transaction_id' => 'TX-'.Str::uuid(), 'sender' => 'TEST', 'recipient' => 'TEST', 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        $this->actingAs($admin)->withoutHeader('Idempotency-Key');
        $this->approve($order, $id)->assertOk()->assertJsonPath('data.wallet_credit.amount', 500);
        $this->approve($order, $id)->assertOk()->assertJsonPath('data.wallet_credit.already_credited', true);
        $this->assertDatabaseHas('nb_online_wallets', ['software_license_id' => $first->id, 'balance' => 100]);
        $this->assertDatabaseHas('nb_online_wallets', ['software_license_id' => $second->id, 'balance' => 600, 'reserved_balance' => 20]);
        (new FulfillOrder($order->id))->handle(app(FulfillmentService::class));
        Bus::assertDispatched(SendOrderReceipt::class, fn ($job) => $job->orderId === $order->id);
        $this->assertSame(1, DB::table('nb_wallet_entries')->where('order_id', $order->id)->count());
        $notification = $first->user->notifications()->where('type', 'order.confirmed')->firstOrFail();
        $this->assertSame(500, $notification->data['wallet_tokens']);
        $this->assertSame($second->license_code, $notification->data['wallet_license']);
        $html = (new OrderReceiptMail($order->fresh(['items', 'invoice'])))->render();
        $this->assertStringContainsString('Wallet credited: 500 tokens', $html);
        $this->assertStringContainsString($second->license_code, $html);
        $this->actingAs($first->user)->getJson('/api/v1/account/licenses/'.$second->license_code.'/wallet')->assertOk()->assertJsonPath('data.wallet.balance', 600);
    }

    public function test_checkout_rejects_suspended_wallet_before_creating_order(): void
    {
        [, , , $license] = $this->scenario();
        $this->actingAs($license->user);
        $variant = ProductVariant::factory()->create(['product_id' => Product::factory()->ofType(ProductType::CreditRefill), 'credit_amount' => 100]);
        Price::factory()->for($variant, 'variant')->amount(10000)->create();
        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id])->assertCreated();
        DB::table('nb_online_wallets')->where('software_license_id', $license->id)->update(['status' => 'suspended']);
        $before = Order::count();
        $this->postJson('/api/v1/checkout', ['name' => 'Test Customer', 'email' => $license->user->email, 'wallet_license_code' => $license->license_code, 'accepts_terms' => true, 'accepts_privacy' => true, 'accepts_refund_policy' => true])->assertConflict();
        $this->assertSame($before, Order::count());
    }

    private function approve(Order $order, int $id): TestResponse
    {
        return $this->postJson('/api/v1/admin/manual-payments/'.$id.'/review', ['decision' => 'approved', 'note' => 'Statement checked', 'confirmed_amount_minor' => $order->total_minor]);
    }

    public function test_approval_credits_once_retries_return_the_same_transaction_and_legacy_cannot_double_credit(): void
    {
        [$order, $payment, $id, $license, $admin] = $this->scenario();
        $first = $this->approve($order, $id)->assertOk()->assertJsonPath('data.wallet_credit.amount', 1000)->assertJsonPath('data.wallet_credit.already_credited', false)->json('data.wallet_credit.transaction_id');
        for ($i = 0; $i < 3; $i++) {
            $this->approve($order, $id)->assertOk()->assertJsonPath('data.wallet_credit.transaction_id', $first)->assertJsonPath('data.wallet_credit.already_credited', true);
        }
        app(OnlineWalletService::class)->credit($order->fresh(), $license);
        $this->assertDatabaseCount('nb_wallet_entries', 1);
        $this->assertDatabaseHas('nb_wallet_entries', ['payment_id' => $payment->id, 'user_id' => $order->user_id, 'software_license_id' => $license->id, 'delta' => 1000, 'created_by' => $admin->id, 'action_type' => 'payment_credit']);
        $this->assertDatabaseHas('nb_online_wallets', ['balance' => 1100, 'reserved_balance' => 20, 'version' => 1]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'wallet.payment_credited', 'user_id' => $admin->id]);
        $this->getJson('/api/v1/admin/manual-payments?status=approved')->assertOk()->assertJsonPath('data.0.wallet_credit.transaction_id', $first);
        Bus::assertDispatchedTimes(FulfillOrder::class, 1);
    }

    public function test_failed_credit_rolls_back_payment_order_and_submission(): void
    {
        [$order, $payment, $id] = $this->scenario();
        $this->mock(ManualWalletCredit::class, function ($mock) {
            $mock->shouldReceive('credit')->once()->andThrow(new \RuntimeException('Injected wallet failure'));
        });
        $this->approve($order, $id)->assertStatus(500);
        $this->assertSame('pending_payment', $order->fresh()->status->value);
        $this->assertSame('pending', $payment->fresh()->status->value);
        $this->assertDatabaseHas('manual_payment_submissions', ['id' => $id, 'status' => 'pending']);
        $this->assertDatabaseCount('nb_wallet_entries', 0);
        Bus::assertNotDispatched(FulfillOrder::class);
    }

    public function test_credited_order_cannot_be_reissued_to_an_unmanaged_license(): void
    {
        [$order, , $id] = $this->scenario();
        $this->approve($order, $id)->assertOk();
        [, , , $other] = $this->scenario(false);
        $other->update(['user_id' => $order->user_id]);
        try {
            app(OnlineLicensingService::class)->refill($order->fresh(), $other);
            $this->fail('Already credited order was reissued');
        } catch (HttpExceptionInterface $e) {
            $this->assertSame(409, $e->getStatusCode());
        }
        $this->assertDatabaseCount('nb_wallet_entries', 1);
        $this->assertDatabaseCount('nb_token_issues', 0);
    }

    public function test_failure_after_ledger_insert_rolls_back_the_whole_operation(): void
    {
        [$order, $payment, $id] = $this->scenario();
        AuditLog::creating(function ($log) {
            if ($log->action === 'payment.manual_approved') {
                throw new \RuntimeException('Audit unavailable');
            }
        });
        try {
            $this->approve($order, $id)->assertStatus(500);
            $this->assertDatabaseCount('nb_wallet_entries', 0);
            $this->assertDatabaseHas('nb_online_wallets', ['balance' => 100, 'version' => 0]);
            $this->assertSame('pending', $payment->fresh()->status->value);
            $this->assertNull($payment->fresh()->wallet_credit_result);
        } finally {
            AuditLog::flushEventListeners();
        }
    }

    public function test_wallet_eligibility_cannot_be_disabled_with_a_feature_flag_and_blocked_wallet_fails_closed(): void
    {
        [$order, , $id, $license] = $this->scenario();
        config(['online_wallet.enabled' => false, 'offline_wallet.enabled' => false]);
        DB::table('nb_online_wallets')->where('software_license_id', $license->id)->update(['status' => 'blocked']);
        $this->approve($order, $id)->assertConflict();
        DB::table('nb_online_wallets')->where('software_license_id', $license->id)->update(['status' => 'active']);
        $this->approve($order, $id)->assertOk()->assertJsonPath('data.wallet_credit.eligible', true);
    }

    public function test_no_wallet_payment_keeps_existing_approval_and_permission_checks(): void
    {
        [$order, , $id, , $admin] = $this->scenario(false);
        $this->actingAs($this->customer());
        $this->approve($order, $id)->assertForbidden();
        $this->actingAs($this->userWithRole(Role::Support));
        $this->approve($order, $id)->assertForbidden();
        $this->actingAs($admin);
        $this->approve($order, $id)->assertOk()->assertJsonPath('data.wallet_credit.eligible', false);
        $this->assertDatabaseCount('nb_wallet_entries', 0);
        $this->assertSame('paid', $order->fresh()->status->value);
    }

    public function test_missing_ledger_on_approved_payment_is_not_silently_reported_as_success(): void
    {
        [$order, $payment, $id] = $this->scenario();
        $this->approve($order, $id)->assertOk();
        DB::table('nb_wallet_entries')->where('payment_id', $payment->id)->delete();
        $this->approve($order, $id)->assertConflict();
    }

    public function test_order_state_machine_cannot_bypass_manual_review(): void
    {
        [$order, $payment] = $this->scenario();
        $payment->update(['status' => 'validated']);
        try {
            app(OrderStateMachine::class)->transition($order, OrderStatus::Paid);
            $this->fail('Bypass was accepted');
        } catch (HttpExceptionInterface $e) {
            $this->assertSame(409, $e->getStatusCode());
        }
        $this->assertSame('pending_payment', $order->fresh()->status->value);
    }

    public function test_ambiguous_target_and_invalid_token_snapshot_block_approval(): void
    {
        [$order, , $id, , $admin] = $this->scenario();
        [, , , $other] = $this->scenario();
        $other->update(['user_id' => $order->user_id]);
        $this->actingAs($admin);
        $this->approve($order, $id)->assertConflict();
        $other->update(['user_id' => $other->order->user_id]);
        $order->items()->update(['fulfillment_meta' => json_encode(['credit_amount' => -5])]);
        $this->approve($order, $id)->assertUnprocessable();
        $this->assertSame('pending_payment', $order->fresh()->status->value);
        $this->assertDatabaseCount('nb_wallet_entries', 0);
    }

    public function test_existing_payment_permission_is_sufficient_without_wallet_management_permission(): void
    {
        [$order, , $id, , $admin] = $this->scenario();
        $role = \App\Models\Role::where('name', 'admin')->firstOrFail();
        $role->permissions()->detach(Permission::whereIn('name', ['wallets.view', 'wallets.manage'])->pluck('id'));
        $this->actingAs($admin->fresh());
        $this->approve($order, $id)->assertOk()->assertJsonPath('data.wallet_credit.amount', 1000);
    }
}
