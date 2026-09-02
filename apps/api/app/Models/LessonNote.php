<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A private study note. Only ever readable by the student who wrote it. */
class LessonNote extends Model
{
    protected $fillable = [
        'enrollment_id', 'lesson_id', 'user_id', 'body', 'position_seconds',
    ];

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }
}
