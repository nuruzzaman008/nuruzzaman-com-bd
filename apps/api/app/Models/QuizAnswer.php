<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizAnswer extends Model
{
    protected $fillable = [
        'quiz_attempt_id', 'quiz_question_id', 'selected_option_ids',
        'text_answer', 'is_correct', 'points_awarded',
    ];

    protected function casts(): array
    {
        return ['selected_option_ids' => 'array', 'is_correct' => 'boolean'];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(QuizAttempt::class, 'quiz_attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(QuizQuestion::class, 'quiz_question_id');
    }
}
