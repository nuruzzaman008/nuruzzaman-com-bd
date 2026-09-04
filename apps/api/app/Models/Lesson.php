<?php

namespace App\Models;

use App\Enums\LessonType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Lesson extends Model
{
    protected $fillable = [
        'course_id', 'course_section_id', 'slug', 'title', 'title_en', 'type',
        'body_markdown',
        'video_provider', 'video_asset_id', 'duration_seconds', 'is_free_preview',
        'position', 'drip_days',
    ];

    /** The provider asset id is only exposed through the signed playback endpoint. */
    protected $hidden = ['video_asset_id'];

    protected function casts(): array
    {
        return ['type' => LessonType::class, 'is_free_preview' => 'boolean'];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(CourseSection::class, 'course_section_id');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(LessonAsset::class)->orderBy('position');
    }

    public function quiz(): HasOne
    {
        return $this->hasOne(Quiz::class);
    }

    public function assignment(): HasOne
    {
        return $this->hasOne(Assignment::class);
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
