<?php

namespace App\Models;

use App\Enums\EnrollmentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Enrollment extends Model
{
    protected $fillable = [
        'user_id', 'course_id', 'order_id', 'order_item_id', 'status', 'source',
        'starts_at', 'expires_at', 'completed_at', 'revoked_at', 'revoked_reason',
        'progress_percent', 'last_lesson_id',
    ];

    protected function casts(): array
    {
        return [
            'status' => EnrollmentStatus::class,
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'completed_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function lastLesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class, 'last_lesson_id');
    }

    public function progress(): HasMany
    {
        return $this->hasMany(LessonProgress::class);
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(QuizAttempt::class);
    }

    public function certificate(): HasOne
    {
        return $this->hasOne(Certificate::class);
    }

    public function isUsable(): bool
    {
        return $this->status->grantsAccess()
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }
}
