<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\Role;
use App\Models\Affiliate;
use App\Models\AffiliateCommission;
use App\Models\Order;
use App\Models\Price;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Referral links, the commission they earn, and paying affiliates from the dashboard. */
class AffiliateProgramTest extends TestCase
{
    use RefreshDatabase;

    private function affiliate(string $code, ?User $user = null): Affiliate
    {
        return Affiliate::create([
            'user_id' => ($user ?? $this->customer())->id,
            'code' => $code,
            'status' => Affiliate::STATUS_ACTIVE,
        ]);
    }

    /** A customer buys one item, with the referral code their browser remembered. */
    private function checkoutWith(?string $code, int $amountMinor, ?User $buyer = null): Order
    {
        $buyer ??= $this->customer();
        $variant = ProductVariant::factory()->create();
        Price::factory()->for($variant, 'variant')->amount($amountMinor)->create();

        $this->actingAs($buyer)->postJson('/api/v1/cart/items', ['variant_id' => $variant->id])->assertCreated();

        $this->actingAs($buyer)->postJson('/api/v1/checkout', [
            'name' => 'Rafiq Hasan',
            'email' => 'rafiq@example.com',
            'accepts_terms' => true,
            'accepts_privacy' => true,
            'accepts_refund_policy' => true,
            'ref' => $code,
        ])->assertCreated();

        return Order::query()->where('user_id', $buyer->id)->latest('id')->firstOrFail();
    }

    private function pay(Order $order): void
    {
        app(OrderStateMachine::class)->transition($order, OrderStatus::Paid, 'Payment verified');
    }

    public function test_a_customer_joins_and_customises_their_link(): void
    {
        $user = $this->customer(['name' => 'Karim Uddin']);

        $joined = $this->actingAs($user)->postJson('/api/v1/account/affiliate')->assertCreated()->json('data');
        $this->assertMatchesRegularExpression('/^karim-uddin-\d{3,4}$/', $joined['affiliate']['code']);
        $this->assertEquals(10, $joined['affiliate']['rate']);
        $this->assertSame(30, $joined['program']['cookie_days']);

        // Joining again changes nothing.
        $this->actingAs($user)->postJson('/api/v1/account/affiliate')->assertOk()
            ->assertJsonPath('data.affiliate.code', $joined['affiliate']['code']);

        $this->actingAs($user)->patchJson('/api/v1/account/affiliate', ['code' => ' Karim-Civil '])->assertOk()
            ->assertJsonPath('data.affiliate.code', 'karim-civil');

        $other = $this->customer();
        $this->actingAs($other)->postJson('/api/v1/account/affiliate', ['code' => 'rahim-eng'])->assertCreated();

        foreach (['karim-civil', 'admin', 'no spaces!', 'ab'] as $refused) {
            $this->actingAs($other)->patchJson('/api/v1/account/affiliate', ['code' => $refused])
                ->assertUnprocessable()->assertJsonValidationErrors('code', 'error.fields');
        }

        $this->actingAs($user)->patchJson('/api/v1/account/affiliate', [
            'payout_method' => 'bkash',
            'payout_account' => '01711000000',
            'payout_name' => 'Karim Uddin',
        ])->assertOk()->assertJsonPath('data.affiliate.payout_method', 'bkash');
    }

    public function test_a_visit_through_a_link_counts_once_a_day(): void
    {
        $affiliate = $this->affiliate('karim-civil');

        $this->postJson('/api/v1/affiliate-visits', ['code' => 'KARIM-CIVIL', 'path' => '/products/nb-engineering-tools'])
            ->assertOk()
            ->assertJsonPath('data.valid', true)
            ->assertJsonPath('data.code', 'karim-civil')
            ->assertJsonPath('data.cookie_days', 30);
        $this->postJson('/api/v1/affiliate-visits', ['code' => 'karim-civil'])->assertOk();
        $this->postJson('/api/v1/affiliate-visits', ['code' => 'nobody-here'])->assertOk()->assertJsonPath('data.valid', false);

        $this->assertSame(1, $affiliate->visits()->count());
    }

    public function test_a_paid_referral_earns_commission_and_a_refund_takes_it_back(): void
    {
        $affiliate = $this->affiliate('karim-civil');
        $order = $this->checkoutWith('karim-civil', 499000);

        $this->assertSame($affiliate->id, $order->affiliate_id);
        $this->assertSame(0, AffiliateCommission::query()->count(), 'Nothing is earned before payment.');

        $this->pay($order);
        $commission = AffiliateCommission::query()->where('order_id', $order->id)->firstOrFail();
        $this->assertSame(499000, $commission->base_minor);
        $this->assertSame(49900, $commission->amount_minor);

        // Held for the refund window before it can be paid out.
        $this->actingAs($affiliate->user)->getJson('/api/v1/account/affiliate')->assertOk()
            ->assertJsonPath('data.affiliate.stats.orders', 1)
            ->assertJsonPath('data.affiliate.stats.pending_minor', 49900)
            ->assertJsonPath('data.affiliate.stats.balance_minor', 0)
            ->assertJsonPath('data.affiliate.commissions.0.state', 'pending')
            ->assertJsonMissingPath('data.affiliate.commissions.0.buyer_email');

        $states = app(OrderStateMachine::class);
        $states->transition($order, OrderStatus::Fulfilled, 'Delivered');
        $this->assertSame(1, AffiliateCommission::query()->count(), 'Fulfilment does not earn it twice.');

        $states->transition($order, OrderStatus::RefundPending, 'Refund requested');
        $order->refresh()->update(['refunded_minor' => 99000]);
        $states->transition($order, OrderStatus::PartiallyRefunded, 'Refund processed');
        $this->assertSame(40000, $commission->fresh()->amount_minor);

        $states->transition($order, OrderStatus::RefundPending, 'Refund requested');
        $order->refresh()->update(['refunded_minor' => 499000]);
        $states->transition($order, OrderStatus::Refunded, 'Refund processed');
        $this->assertSame('void', $commission->fresh()->state());
    }

    public function test_no_one_earns_from_their_own_link_or_while_suspended(): void
    {
        $owner = $this->customer();
        $affiliate = $this->affiliate('self-buyer', $owner);

        $this->assertNull($this->checkoutWith('self-buyer', 100000, $owner)->affiliate_id);

        $affiliate->update(['status' => Affiliate::STATUS_SUSPENDED]);
        $this->assertNull($this->checkoutWith('self-buyer', 100000)->affiliate_id);
    }

    public function test_the_owner_sets_the_rate_and_pays_affiliates_from_their_balance(): void
    {
        $admin = $this->userWithRole(Role::SuperAdmin);

        $this->actingAs($admin)->putJson('/api/v1/admin/affiliate-settings', [
            'default_rate' => 12.5,
            'hold_days' => 0,
            'min_payout_minor' => 100000,
        ])->assertOk()->assertJsonPath('data.default_rate', 12.5)->assertJsonPath('data.hold_days', 0);

        $affiliate = $this->affiliate('rahim-eng');
        $first = $this->checkoutWith('rahim-eng', 400000);
        $this->pay($first);
        $this->assertSame(50000, AffiliateCommission::query()->where('order_id', $first->id)->value('amount_minor'));

        // An affiliate's own rate applies to later orders; earlier ones keep theirs.
        // Compared by value: JSON writes a whole-number rate without its ".0".
        $updated = $this->actingAs($admin)->patchJson("/api/v1/admin/affiliates/{$affiliate->id}", ['commission_rate' => 20])
            ->assertOk();
        $this->assertEquals(20, $updated->json('data.rate'));
        $this->assertEquals(20, $updated->json('data.commission_rate'));
        $second = $this->checkoutWith('rahim-eng', 100000);
        $this->pay($second);
        $this->assertSame(20000, AffiliateCommission::query()->where('order_id', $second->id)->value('amount_minor'));
        $this->assertSame(50000, AffiliateCommission::query()->where('order_id', $first->id)->value('amount_minor'));

        // A payout can never be more than the balance.
        $this->actingAs($admin)->postJson("/api/v1/admin/affiliates/{$affiliate->id}/payouts", [
            'amount_minor' => 80000,
            'method' => 'bkash',
        ])->assertUnprocessable();

        $this->actingAs($admin)->postJson("/api/v1/admin/affiliates/{$affiliate->id}/payouts", [
            'amount_minor' => 60000,
            'method' => 'bkash',
            'reference' => 'TXN8H2K1',
        ])->assertCreated()
            ->assertJsonPath('data.stats.paid_minor', 60000)
            ->assertJsonPath('data.stats.balance_minor', 10000)
            ->assertJsonPath('data.commissions.0.buyer_name', 'Rafiq Hasan');

        $this->actingAs($admin)->getJson('/api/v1/admin/affiliates?q=rahim')->assertOk()
            ->assertJsonPath('data.0.code', 'rahim-eng')
            ->assertJsonPath('data.0.stats.orders', 2)
            ->assertJsonPath('data.0.stats.balance_minor', 10000);

        $this->actingAs($affiliate->user)->getJson('/api/v1/account/affiliate')->assertOk()
            ->assertJsonPath('data.affiliate.payouts.0.reference', 'TXN8H2K1')
            ->assertJsonPath('data.affiliate.stats.balance_minor', 10000);

        // Voiding a commission already paid out leaves the balance owed back.
        $commissionId = AffiliateCommission::query()->where('order_id', $first->id)->value('id');
        $this->actingAs($admin)->postJson("/api/v1/admin/affiliate-commissions/{$commissionId}/void", ['reason' => 'Chargeback'])
            ->assertOk()->assertJsonPath('data.stats.balance_minor', -40000);
    }

    public function test_customers_cannot_run_the_program(): void
    {
        $customer = $this->customer();
        $affiliate = $this->affiliate('sneaky', $customer);

        $this->actingAs($customer);
        $this->putJson('/api/v1/admin/affiliate-settings', ['default_rate' => 50])->assertForbidden();
        $this->patchJson("/api/v1/admin/affiliates/{$affiliate->id}", ['commission_rate' => 90])->assertForbidden();
        $this->postJson("/api/v1/admin/affiliates/{$affiliate->id}/payouts", ['amount_minor' => 100, 'method' => 'bkash'])->assertForbidden();

        $this->assertNull($affiliate->fresh()->commission_rate);
        $this->assertSame(0, $affiliate->payouts()->count());
    }
}
