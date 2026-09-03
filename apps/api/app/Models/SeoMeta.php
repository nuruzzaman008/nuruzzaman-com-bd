<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class SeoMeta extends Model
{
    protected $table = 'seo_meta';

    protected $fillable = [
        'seoable_type', 'seoable_id', 'meta_title', 'meta_description', 'focus_keyword',
        'canonical_url', 'og_media_id', 'noindex', 'nofollow', 'extra',
    ];

    protected function casts(): array
    {
        return ['noindex' => 'boolean', 'nofollow' => 'boolean', 'extra' => 'array'];
    }

    public function seoable(): MorphTo
    {
        return $this->morphTo();
    }

    public function ogImage(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'og_media_id');
    }
}
