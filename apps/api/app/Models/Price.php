<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Price extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_variant_id', 'currency', 'amount_minor',
        'compare_at_minor', 'starts_at', 'ends_at', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'amount_minor' => 'integer',
            'compare_at_minor' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function isEffective(?\DateTimeInterface $at = null): bool
    {
        $at ??= now();

        return (! $this->starts_at || $this->starts_at <= $at)
            && (! $this->ends_at || $this->ends_at >= $at);
    }
}
