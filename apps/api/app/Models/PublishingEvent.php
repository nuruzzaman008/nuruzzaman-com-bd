<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class PublishingEvent extends Model
{
    protected $fillable = [
        'publishable_type', 'publishable_id', 'from_status', 'to_status',
        'actor_id', 'note', 'revalidated_at',
    ];

    protected function casts(): array
    {
        return ['revalidated_at' => 'datetime'];
    }

    public function publishable(): MorphTo
    {
        return $this->morphTo();
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
