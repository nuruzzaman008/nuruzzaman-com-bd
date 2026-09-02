<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LessonAsset extends Model
{
    protected $fillable = [
        'lesson_id', 'title', 'disk', 'storage_path', 'mime_type',
        'size_bytes', 'checksum_sha256', 'position',
    ];

    protected $hidden = ['disk', 'storage_path'];

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }
}
