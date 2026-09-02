<?php

namespace App\Models;

use App\Enums\ContentStatus;
use App\Enums\ProductType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'slug', 'type', 'name', 'tagline', 'description_markdown', 'status',
        'cover_media_id', 'feature_groups', 'specs', 'is_price_public', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => ProductType::class,
            'status' => ContentStatus::class,
            'feature_groups' => 'array',
            'specs' => 'array',
            'is_price_public' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('position');
    }

    public function activeVariants(): HasMany
    {
        return $this->variants()->where('is_active', true);
    }

    public function cover(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    public function seo(): MorphOne
    {
        return $this->morphOne(SeoMeta::class, 'seoable');
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', ContentStatus::Published->value);
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
