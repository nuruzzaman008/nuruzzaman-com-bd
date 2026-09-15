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
        'uploaded_by', 'disk', 'path', 'original_name', 'title', 'mime_type', 'size_bytes',
        'width', 'height', 'duration_seconds', 'checksum_sha256', 'alt_text', 'caption',
        'description', 'credit', 'exclude_from_sitemap', 'focal_x', 'focal_y',
    ];

    protected function casts(): array
    {
        return [
            'focal_x' => 'float',
            'focal_y' => 'float',
            'duration_seconds' => 'integer',
            'exclude_from_sitemap' => 'boolean',
            'edited_at' => 'datetime',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * The file's public address. An image edited in place keeps its path, so
     * pages that embed it keep working; the version marker makes browsers and
     * the image optimiser fetch the new pixels instead of a cached copy.
     */
    public function url(): ?string
    {
        if ($this->disk !== 'public') {
            return null;
        }

        $url = Storage::disk($this->disk)->url($this->path);

        return $this->edited_at ? $url.'?v='.$this->edited_at->getTimestamp() : $url;
    }
}
