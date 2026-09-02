<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentEvent extends Model
{
    protected $fillable = [
        'payment_id', 'source', 'event_type', 'fingerprint', 'payload',
        'remote_ip', 'is_valid', 'validation_error', 'processed_at',
    ];

    protected function casts(): array
    {
        return ['payload' => 'array', 'is_valid' => 'boolean', 'processed_at' => 'datetime'];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
