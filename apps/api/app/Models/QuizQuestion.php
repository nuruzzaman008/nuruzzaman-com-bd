<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuizQuestion extends Model
{
    protected $fillable = ['quiz_id', 'type', 'prompt', 'explanation', 'points', 'position'];

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(QuizOption::class)->orderBy('position');
    }

    public function correctOptionIds(): array
    {
        return $this->options->where('is_correct', true)->pluck('id')->sort()->values()->all();
    }
}
