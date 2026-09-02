<?php

namespace App\Models;

use App\Enums\ContentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourseQuestionReply extends Model
{
    protected $fillable = [
        'course_question_id', 'user_id', 'body', 'from_instructor', 'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => ContentStatus::class,
            'from_instructor' => 'boolean',
        ];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(CourseQuestion::class, 'course_question_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
