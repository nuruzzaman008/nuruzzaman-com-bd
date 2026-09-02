<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentSubmission extends Model
{
    protected $fillable = [
        'assignment_id', 'enrollment_id', 'user_id', 'notes', 'disk',
        'storage_path', 'original_filename', 'status', 'score_percent',
        'feedback', 'reviewed_by', 'submitted_at', 'reviewed_at',
    ];

    protected $hidden = ['disk', 'storage_path'];

    protected function casts(): array
    {
        return ['submitted_at' => 'datetime', 'reviewed_at' => 'datetime'];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }
}
