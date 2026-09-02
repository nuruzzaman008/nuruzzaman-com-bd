<?php

namespace App\Services\Commerce;

use App\Support\Money;

/**
 * The authoritative total for a cart, always recomputed on the server. A total
 * sent by the browser is never trusted or persisted.
 */
final class CartTotals
{
    /**
     * @param  array<int, CartLine>  $lines
     */
    public function __construct(
        public readonly array $lines,
        public readonly Money $subtotal,
        public readonly Money $discount,
        public readonly Money $tax,
        public readonly Money $total,
        public readonly ?string $couponCode = null,
        public readonly ?string $couponError = null,
        public readonly bool $isPurchasable = true,
        public readonly array $blockers = [],
    ) {}

    public function toArray(): array
    {
        return [
            'currency' => $this->subtotal->currency,
            'subtotal_minor' => $this->subtotal->minor,
            'discount_minor' => $this->discount->minor,
            'tax_minor' => $this->tax->minor,
            'total_minor' => $this->total->minor,
            'coupon_code' => $this->couponCode,
            'coupon_error' => $this->couponError,
            'is_purchasable' => $this->isPurchasable,
            'blockers' => $this->blockers,
            'lines' => array_map(fn (CartLine $line) => $line->toArray(), $this->lines),
        ];
    }
}
