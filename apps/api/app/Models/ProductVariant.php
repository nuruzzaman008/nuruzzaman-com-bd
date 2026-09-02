<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductVariant extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id', 'sku', 'name', 'description', 'credit_amount',
        'license_term_days', 'device_limit', 'access_duration_days',
        'course_id', 'is_active', 'position',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function prices(): HasMany
    {
        return $this->hasMany(Price::class);
    }

    public function downloadAssets(): BelongsToMany
    {
        return $this->belongsToMany(DownloadAsset::class, 'download_asset_product_variant')
            ->withPivot(['max_downloads', 'valid_days']);
    }

    public function bundledVariants(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'bundle_items', 'bundle_variant_id', 'item_variant_id')
            ->withPivot('quantity');
    }

    /**
     * The price that is in effect right now, or null when the owner has not
     * published one yet. Callers must render an honest unavailable state
     * instead of substituting zero.
     */
    public function currentPrice(): ?Price
    {
        return $this->prices
            ->where('is_active', true)
            ->filter(fn (Price $price) => $price->isEffective())
            ->sortByDesc('starts_at')
            ->first();
    }
}
