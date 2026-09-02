<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id', 'product_variant_id', 'product_type', 'product_name',
        'variant_name', 'sku', 'quantity', 'unit_price_minor', 'discount_minor',
        'tax_minor', 'line_total_minor', 'fulfillment_meta',
    ];

    protected function casts(): array
    {
        return [
            'unit_price_minor' => 'integer',
            'discount_minor' => 'integer',
            'tax_minor' => 'integer',
            'line_total_minor' => 'integer',
            'fulfillment_meta' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
