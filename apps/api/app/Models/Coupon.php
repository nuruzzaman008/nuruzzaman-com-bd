<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Coupon extends Model
{
    protected $fillable = [
        'code', 'description', 'discount_type', 'discount_value',
        'minimum_subtotal_minor', 'max_redemptions', 'max_redemptions_per_user',
        'starts_at', 'ends_at', 'is_active', 'applies_to_variant_ids',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
            'applies_to_variant_ids' => 'array',
        ];
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }

    public function isWithinWindow(?\DateTimeInterface $at = null): bool
    {
        $at ??= now();

        return $this->is_active
            && (! $this->starts_at || $this->starts_at <= $at)
            && (! $this->ends_at || $this->ends_at >= $at);
    }
}
