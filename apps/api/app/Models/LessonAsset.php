<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LessonAsset extends Model
{
    /** A document that lives elsewhere - Google Drive, Dropbox - whose address is in storage_path. */
    public const LINK_DISK = 'link';

    protected $fillable = [
        'lesson_id', 'title', 'disk', 'storage_path', 'mime_type',
        'size_bytes', 'checksum_sha256', 'position',
    ];

    protected $hidden = ['disk', 'storage_path'];

    /**
     * Whether this is a stored file or a link, and a link's address, for the
     * admin curriculum. A stored file's path on disk stays hidden.
     */
    protected $appends = ['kind', 'link_url'];

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    public function isLink(): bool
    {
        return $this->disk === self::LINK_DISK;
    }

    public function getKindAttribute(): string
    {
        return $this->isLink() ? 'link' : 'file';
    }

    public function getLinkUrlAttribute(): ?string
    {
        return $this->isLink() ? $this->storage_path : null;
    }
}
