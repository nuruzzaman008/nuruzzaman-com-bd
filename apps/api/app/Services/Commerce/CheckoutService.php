<?php

namespace App\Services\Commerce;

use App\Enums\OrderStatus;
use App\Exceptions\DomainException;
use App\Models\Cart;
use App\Models\Order;
use App\Models\User;
use App\Support\Audit;
use App\Support\Reference;
use Illuminate\Support\Facades\DB;

/**
 * Turns a server-priced cart into a pending order. Amounts are recalculated
 * here; nothing supplied by the browser reaches the totals.
 */
class CheckoutService
{
    public function __construct(
        private readonly PricingService $pricing,
        private readonly OrderStateMachine $states,
    ) {}

    /**
     * @param  array{name?:string,email?:string,phone?:string}  $billing
     * @param  array<int, string>  $acceptedTerms
     */
    public function createOrder(Cart $cart, User $user, array $billing, array $acceptedTerms, ?string $ip = null): Order
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

        return DB::transaction(function () use ($cart, $user, $billing, $acceptedTerms, $ip, $totals) {
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
                        'credit_amount' => $line->variant->credit_amount,
                        'license_term_days' => $line->variant->license_term_days,
                        'device_limit' => $line->variant->device_limit,
                        'access_duration_days' => $line->variant->access_duration_days,
                    ],
                ]);
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
