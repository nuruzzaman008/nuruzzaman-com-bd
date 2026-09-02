<?php

namespace App\Services\Commerce;

use App\Models\Cart;
use App\Models\Coupon;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\Money;

/**
 * Single source of truth for what a cart costs. Everything - the storefront,
 * checkout and the payment session - reads its numbers from here.
 */
class PricingService
{
    public function totalsFor(Cart $cart, ?User $user = null): CartTotals
    {
        $cart->loadMissing(['items.variant.product', 'items.variant.prices', 'coupon']);

        $currency = $cart->currency;
        $lines = [];
        $subtotal = Money::zero($currency);
        $blockers = [];

        foreach ($cart->items as $item) {
            $line = $this->lineFor($item->variant, $item->quantity, $currency);
            $lines[] = $line;

            if ($line->isPurchasable()) {
                $subtotal = $subtotal->plus($line->lineTotal);
            } else {
                $blockers[] = $line->variant->sku.': '.$line->unavailableReason;
            }
        }

        [$discount, $couponError] = $this->discountFor($cart->coupon, $subtotal, $lines, $user);

        $taxable = $subtotal->minus($discount);
        $tax = $this->taxFor($taxable);
        $total = $taxable->plus($tax);

        return new CartTotals(
            lines: $lines,
            subtotal: $subtotal,
            discount: $discount,
            tax: $tax,
            total: $total,
            couponCode: $cart->coupon?->code,
            couponError: $couponError,
            isPurchasable: $blockers === [] && $lines !== [],
            blockers: $blockers,
        );
    }

    public function lineFor(ProductVariant $variant, int $quantity, string $currency = 'BDT'): CartLine
    {
        $variant->loadMissing(['product', 'prices']);
        $price = $variant->currentPrice();

        if (! $variant->is_active) {
            return new CartLine($variant, $quantity, null, Money::zero($currency), 'This item is no longer available.');
        }

        if (! $price) {
            // No published price is an honest "contact for price" state, not zero.
            return new CartLine($variant, $quantity, null, Money::zero($currency), 'No published price for this item yet.');
        }

        if ($price->currency !== $currency) {
            return new CartLine($variant, $quantity, null, Money::zero($currency), 'Price currency does not match the cart currency.');
        }

        $unit = Money::minor($price->amount_minor, $price->currency);

        return new CartLine($variant, $quantity, $unit, $unit->times($quantity));
    }

    /**
     * @param  array<int, CartLine>  $lines
     * @return array{0: Money, 1: ?string}
     */
    public function discountFor(?Coupon $coupon, Money $subtotal, array $lines, ?User $user): array
    {
        if (! $coupon) {
            return [Money::zero($subtotal->currency), null];
        }

        if (! $coupon->isWithinWindow()) {
            return [Money::zero($subtotal->currency), 'This coupon is not currently valid.'];
        }

        if ($coupon->max_redemptions !== null && $coupon->redemption_count >= $coupon->max_redemptions) {
            return [Money::zero($subtotal->currency), 'This coupon has reached its redemption limit.'];
        }

        if ($user && $this->userRedemptions($coupon, $user) >= $coupon->max_redemptions_per_user) {
            return [Money::zero($subtotal->currency), 'You have already used this coupon.'];
        }

        $eligible = $this->eligibleSubtotal($coupon, $lines, $subtotal);

        if ($eligible->minor < $coupon->minimum_subtotal_minor) {
            return [Money::zero($subtotal->currency), 'This coupon needs a higher order subtotal.'];
        }

        $discount = $coupon->discount_type === 'percent'
            ? $eligible->percentage(min(100, $coupon->discount_value))
            : Money::minor(min($coupon->discount_value, $eligible->minor), $subtotal->currency);

        return [$discount, null];
    }

    public function taxFor(Money $taxable): Money
    {
        $percent = config('nb.commerce.tax_percent');

        // Tax is only applied once the owner has supplied a rule. Until then the
        // order shows no tax line rather than an invented one.
        if ($percent === null || $percent <= 0) {
            return Money::zero($taxable->currency);
        }

        return $taxable->percentage((int) $percent);
    }

    private function userRedemptions(Coupon $coupon, User $user): int
    {
        return $coupon->redemptions()->where('user_id', $user->getKey())->count();
    }

    /** @param array<int, CartLine> $lines */
    private function eligibleSubtotal(Coupon $coupon, array $lines, Money $subtotal): Money
    {
        $allowed = $coupon->applies_to_variant_ids;

        if (! $allowed) {
            return $subtotal;
        }

        $eligible = Money::zero($subtotal->currency);

        foreach ($lines as $line) {
            if ($line->isPurchasable() && in_array($line->variant->id, $allowed, true)) {
                $eligible = $eligible->plus($line->lineTotal);
            }
        }

        return $eligible;
    }
}
