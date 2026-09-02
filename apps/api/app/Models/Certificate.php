<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Certificate extends Model
{
    protected $fillable = [
        'enrollment_id', 'user_id', 'course_id', 'verification_id', 'recipient_name',
        'course_title', 'score_percent', 'document_disk', 'document_path',
        'issued_at', 'revoked_at',
    ];

    protected $hidden = ['document_disk', 'document_path'];

    protected function casts(): array
    {
        return ['issued_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function isValid(): bool
    {
        return $this->revoked_at === null;
    }

    public function getRouteKeyName(): string
    {
        return 'verification_id';
    }
}
