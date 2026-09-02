<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    protected $fillable = [
        'order_id', 'gateway', 'reference', 'gateway_session_key',
        'gateway_transaction_id', 'bank_transaction_id', 'card_type', 'status',
        'currency', 'amount_minor', 'settled_amount_minor', 'risk_level',
        'risk_title', 'validated_at', 'failed_at',
    ];

    protected $hidden = ['gateway_session_key'];

    protected function casts(): array
    {
        return [
            'status' => PaymentStatus::class,
            'amount_minor' => 'integer',
            'settled_amount_minor' => 'integer',
            'validated_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(PaymentEvent::class);
    }
}
