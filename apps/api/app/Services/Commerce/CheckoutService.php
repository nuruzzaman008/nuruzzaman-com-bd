<?php

namespace App\Services\Commerce;

use App\Enums\OrderStatus;
use App\Exceptions\DomainException;
use App\Models\Cart;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\RefillOrder;
use App\Models\SoftwareLicense;
use App\Models\User;
use App\Services\Affiliates\AffiliateProgram;
use App\Services\Licensing\OnlineLicensingService;
use App\Support\Audit;
use App\Support\Reference;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Turns a server-priced cart into a pending order. Amounts are recalculated
 * here; nothing supplied by the browser reaches the totals.
 */
class CheckoutService
{
    public function __construct(
        private readonly PricingService $pricing,
        private readonly OrderStateMachine $states,
        private readonly AffiliateProgram $affiliates,
    ) {}

    /**
     * @param  array{name?:string,email?:string,phone?:string}  $billing
     * @param  array<int, string>  $acceptedTerms
     * @param  string|null  $referralCode  the affiliate code remembered from a referral link
     */
    public function createOrder(Cart $cart, User $user, array $billing, array $acceptedTerms, ?string $ip = null, ?string $referralCode = null, ?string $walletLicenseCode = null): Order
    {
        $totals = $this->pricing->totalsFor($cart, $user);

        if (! $totals->isPurchasable) {
            throw new DomainException(
                $totals->blockers ? implode(' ', $totals->blockers) : 'Your cart is empty.'
            );
        }

        if ($totals->couponError) {
            throw new DomainException($totals->couponError);
        }

        if ($totals->total->isZero()) {
            throw new DomainException('This order total is zero, which the payment gateway cannot process.');
        }

        $affiliate = $referralCode ? $this->affiliates->attributable($referralCode, $user) : null;

        return DB::transaction(function () use ($cart, $user, $billing, $acceptedTerms, $ip, $totals, $affiliate, $walletLicenseCode) {
            $refills = collect($totals->lines)->filter(fn ($line) => $line->variant->product?->type?->value === 'credit_refill');
            $license = null;
            if ($refills->isNotEmpty()) {
                $hasWallet = DB::table('nb_online_wallets')->join('software_licenses', 'software_licenses.id', '=', 'nb_online_wallets.software_license_id')->where('software_licenses.user_id', $user->id)->exists();
                if ($hasWallet && ! $walletLicenseCode) {
                    throw ValidationException::withMessages(['wallet_license_code' => 'Choose the license that should receive these tokens.']);
                }
                if ($walletLicenseCode) {
                    $license = SoftwareLicense::where('user_id', $user->id)->where('license_code', $walletLicenseCode)->lockForUpdate()->first();
                    abort_unless($license, 422, 'Choose one of your own licenses.');
                    app(OnlineLicensingService::class)->usable($license);
                    abort_unless($user->isActive() && $user->hasVerifiedEmail(), 403);
                    $wallet = DB::table('nb_online_wallets')->where('software_license_id', $license->id)->lockForUpdate()->first();
                    abort_unless($wallet && $wallet->status === 'active', 409, 'This license needs an active online wallet before buying tokens.');
                    $tokens = $refills->sum(fn ($line) => (int) $line->variant->credit_amount * $line->quantity);
                    abort_unless($tokens > 0 && $tokens <= 1000000, 422, 'Token quantity exceeds the purchase limit.');
                }
            } else {
                abort_if($walletLicenseCode, 422, 'A wallet license requires a token pack in the cart.');
            }
            // First in the transaction, so the counts below read what other
            // checkouts committed while this one waited for the lock. Two
            // customers placing orders at the same moment could otherwise both
            // take the last use of a coupon.
            if ($cart->coupon_id) {
                $coupon = Coupon::query()->lockForUpdate()->find($cart->coupon_id);
                $couponError = $coupon
                    ? $this->pricing->couponLimitError($coupon, $user, locking: true)
                    : 'This coupon code is not valid.';

                if ($couponError) {
                    throw new DomainException($couponError);
                }
            }

            $order = Order::create([
                'number' => Reference::order(),
                'user_id' => $user->getKey(),
                'status' => OrderStatus::Draft,
                'currency' => $totals->total->currency,
                'subtotal_minor' => $totals->subtotal->minor,
                'discount_minor' => $totals->discount->minor,
                'tax_minor' => $totals->tax->minor,
                'total_minor' => $totals->total->minor,
                'coupon_id' => $cart->coupon_id,
                'affiliate_id' => $affiliate?->getKey(),
                'billing_name' => $billing['name'] ?? $user->name,
                'billing_email' => $billing['email'] ?? $user->email,
                'billing_phone' => $billing['phone'] ?? $user->phone,
                'accepted_terms' => $acceptedTerms,
                'terms_accepted_at' => now(),
                'placed_ip' => $ip,
            ]);

            foreach ($totals->lines as $line) {
                $order->items()->create([
                    'product_variant_id' => $line->variant->getKey(),
                    'product_type' => $line->variant->product?->type?->value ?? 'digital_resource',
                    'product_name' => $line->variant->product?->name ?? $line->variant->name,
                    'variant_name' => $line->variant->name,
                    'sku' => $line->variant->sku,
                    'quantity' => $line->quantity,
                    'unit_price_minor' => $line->unitPrice?->minor ?? 0,
                    'line_total_minor' => $line->lineTotal->minor,
                    'fulfillment_meta' => [
                        'course_id' => $line->variant->course_id,
                        'wallet_license_code' => $line->variant->product?->type?->value === 'credit_refill' ? $license?->license_code : null,
                        'credit_amount' => $line->variant->credit_amount,
                        'license_term_days' => $line->variant->license_term_days,
                        'device_limit' => $line->variant->device_limit,
                        'access_duration_days' => $line->variant->access_duration_days,
                    ],
                ]);
            }

            if ($license) {
                foreach ($refills as $line) {
                    RefillOrder::firstOrCreate(
                        ['order_id' => $order->id, 'credit_amount' => $line->variant->credit_amount * $line->quantity],
                        ['reference' => Reference::refill(), 'user_id' => $user->id, 'software_license_id' => $license->id, 'status' => 'requested'],
                    );
                }
            }
            $cart->update(['status' => 'converted']);

            Audit::record('order.created', $order, [
                'total_minor' => $order->total_minor,
                'items' => $order->items()->count(),
            ], $user->getKey());

            return $this->states->transition($order, OrderStatus::PendingPayment, 'Checkout started', $user)
                ->load('items');
        });
    }
}
