<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DownloadAsset extends Model
{
    protected $fillable = [
        'slug', 'name', 'version', 'disk', 'storage_path', 'original_filename',
        'size_bytes', 'checksum_sha256', 'code_signing_status', 'test_status',
        'release_notes_markdown', 'is_available', 'released_at',
    ];

    /** The private storage path is never serialised to a client. */
    protected $hidden = ['storage_path', 'disk'];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'is_available' => 'boolean',
            'released_at' => 'datetime',
        ];
    }

    public function entitlements(): HasMany
    {
        return $this->hasMany(DownloadEntitlement::class);
    }

    public function variants(): BelongsToMany
    {
        return $this->belongsToMany(ProductVariant::class, 'download_asset_product_variant')
            ->withPivot(['max_downloads', 'valid_days']);
    }

    /** A file is only servable once it exists on the private disk. */
    public function isServable(): bool
    {
        return $this->is_available && filled($this->storage_path);
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
