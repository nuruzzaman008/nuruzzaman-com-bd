<?php

namespace App\Models;

use App\Enums\ContentStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Several courses sold as one purchase. */
class CourseBundle extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'slug', 'title', 'subtitle', 'description_markdown', 'status',
        'cover_media_id', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ContentStatus::class,
            'published_at' => 'datetime',
        ];
    }

    public function courses(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'course_bundle_items')
            ->withPivot('position')
            ->orderBy('course_bundle_items.position');
    }

    public function cover(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    /** A bundle is only listed once it is published and holds a course. */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', ContentStatus::Published->value)
            ->whereHas('courses');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
