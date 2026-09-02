<?php

namespace App\Services\Commerce;

use App\Models\ProductVariant;
use App\Support\Money;

final class CartLine
{
    public function __construct(
        public readonly ProductVariant $variant,
        public readonly int $quantity,
        public readonly ?Money $unitPrice,
        public readonly Money $lineTotal,
        public readonly ?string $unavailableReason = null,
    ) {}

    public function isPurchasable(): bool
    {
        return $this->unavailableReason === null;
    }

    public function toArray(): array
    {
        return [
            'variant_id' => $this->variant->id,
            'sku' => $this->variant->sku,
            'product_name' => $this->variant->product?->name,
            'product_slug' => $this->variant->product?->slug,
            'product_type' => $this->variant->product?->type?->value,
            'variant_name' => $this->variant->name,
            'quantity' => $this->quantity,
            'unit_price_minor' => $this->unitPrice?->minor,
            'line_total_minor' => $this->lineTotal->minor,
            'unavailable_reason' => $this->unavailableReason,
        ];
    }
}
