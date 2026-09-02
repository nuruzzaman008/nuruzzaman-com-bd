<?php

namespace App\Models;

use App\Enums\ContentStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A student question on a course, optionally anchored to one lesson. */
class CourseQuestion extends Model
{
    protected $fillable = [
        'course_id', 'lesson_id', 'enrollment_id', 'user_id', 'title', 'body',
        'status', 'is_pinned', 'reply_count', 'answered_at', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ContentStatus::class,
            'is_pinned' => 'boolean',
            'answered_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function replies(): HasMany
    {
        return $this->hasMany(CourseQuestionReply::class)->orderBy('created_at');
    }

    /** Only moderated questions are readable by the rest of the class. */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('status', ContentStatus::Published->value);
    }
}
