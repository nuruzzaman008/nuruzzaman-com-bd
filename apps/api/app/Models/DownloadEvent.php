<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DownloadEvent extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'download_entitlement_id', 'user_id', 'outcome',
        'ip_address', 'user_agent', 'request_id', 'created_at',
    ];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function entitlement(): BelongsTo
    {
        return $this->belongsTo(DownloadEntitlement::class, 'download_entitlement_id');
    }
}
