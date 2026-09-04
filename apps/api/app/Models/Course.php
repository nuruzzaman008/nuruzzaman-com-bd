<?php

namespace App\Models;

use App\Enums\ContentStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Course extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'slug', 'title', 'title_en', 'subtitle', 'subtitle_en',
        'description_markdown', 'status', 'level', 'track',
        'language', 'cover_media_id', 'outcomes', 'audience', 'prerequisites',
        'required_software', 'estimated_minutes', 'access_duration_days',
        'sequential', 'pass_percentage', 'issues_certificate', 'support_policy',
        'refund_policy', 'last_reviewed_at', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ContentStatus::class,
            'outcomes' => 'array',
            'audience' => 'array',
            'prerequisites' => 'array',
            'required_software' => 'array',
            'sequential' => 'boolean',
            'issues_certificate' => 'boolean',
            'last_reviewed_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    public function sections(): HasMany
    {
        return $this->hasMany(CourseSection::class)->orderBy('position');
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(Lesson::class)->orderBy('position');
    }

    public function instructors(): HasMany
    {
        return $this->hasMany(CourseInstructor::class)->orderBy('position');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(CourseReview::class);
    }

    public function quizzes(): HasMany
    {
        return $this->hasMany(Quiz::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }

    public function announcements(): HasMany
    {
        return $this->hasMany(CourseAnnouncement::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(CourseQuestion::class);
    }

    /** Courses a student is expected to have finished before this one. */
    public function prerequisiteCourses(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'course_prerequisites', 'course_id', 'required_course_id')
            ->withPivot(['is_blocking', 'position'])
            ->orderBy('course_prerequisites.position');
    }

    public function bundles(): BelongsToMany
    {
        return $this->belongsToMany(CourseBundle::class, 'course_bundle_items');
    }

    /** Variants that sell access to this course (direct or inside a bundle). */
    public function purchasableVariants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->where('is_active', true);
    }

    public function cover(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    public function seo(): MorphOne
    {
        return $this->morphOne(SeoMeta::class, 'seoable');
    }

    /**
     * A course is only listed publicly once it is published AND has at least one
     * real lesson, so an empty placeholder can never be indexed.
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', ContentStatus::Published->value)
            ->whereHas('lessons');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
