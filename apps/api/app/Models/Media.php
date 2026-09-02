<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Media extends Model
{
    use HasFactory;

    protected $table = 'media';

    protected $fillable = [
        'uploaded_by', 'disk', 'path', 'original_name', 'mime_type', 'size_bytes',
        'width', 'height', 'checksum_sha256', 'alt_text', 'caption', 'credit',
        'focal_x', 'focal_y',
    ];

    protected function casts(): array
    {
        return ['focal_x' => 'float', 'focal_y' => 'float'];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function url(): ?string
    {
        if ($this->disk !== 'public') {
            return null;
        }

        return Storage::disk($this->disk)->url($this->path);
    }
}
