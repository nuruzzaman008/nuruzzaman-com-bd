<?php

namespace App\Models;

use App\Enums\ContentStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Page extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'slug', 'title', 'body_markdown', 'status', 'template',
        'requires_legal_review', 'legal_reviewed', 'legal_reviewer',
        'legal_reviewed_at', 'published_at', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => ContentStatus::class,
            'requires_legal_review' => 'boolean',
            'legal_reviewed' => 'boolean',
            'legal_reviewed_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    public function seo(): MorphOne
    {
        return $this->morphOne(SeoMeta::class, 'seoable');
    }

    /**
     * A legal page that has not been signed off still renders, but the frontend
     * shows a visible DRAFT notice instead of pretending the text is final.
     */
    public function isAwaitingLegalReview(): bool
    {
        return $this->requires_legal_review && ! $this->legal_reviewed;
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
