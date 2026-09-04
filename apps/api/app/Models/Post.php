<?php

namespace App\Models;

use App\Enums\CommentStatus;
use App\Enums\ContentStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'slug', 'title', 'title_en', 'excerpt', 'excerpt_en', 'body_markdown',
        'status', 'author_id',
        'reviewed_by_author_id', 'reviewed_at', 'cover_media_id', 'reading_minutes',
        'funnel_stage', 'search_intent', 'scheduled_for', 'published_at',
        'content_updated_at', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => ContentStatus::class,
            'reviewed_at' => 'datetime',
            'scheduled_for' => 'datetime',
            'published_at' => 'datetime',
            'content_updated_at' => 'datetime',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(Author::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(Author::class, 'reviewed_by_author_id');
    }

    public function cover(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(PostComment::class);
    }

    /**
     * The only comments a reader ever sees or is counted among.
     *
     * A separate relation rather than a scope at the call site: an average
     * that quietly included pending or spam rows would be wrong in a way
     * nobody would notice until it was on the page.
     */
    public function approvedComments(): HasMany
    {
        return $this->comments()->where('status', CommentStatus::Approved->value);
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(PostRevision::class)->orderByDesc('revision');
    }

    public function seo(): MorphOne
    {
        return $this->morphOne(SeoMeta::class, 'seoable');
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', ContentStatus::Published->value)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
