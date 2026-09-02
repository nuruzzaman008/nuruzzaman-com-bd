<?php

namespace App\Models;

use App\Enums\RefundStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Refund extends Model
{
    protected $fillable = [
        'order_id', 'payment_id', 'requested_by', 'decided_by', 'status',
        'amount_minor', 'reason', 'gateway_refund_id', 'revoke_entitlements',
        'decided_at', 'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => RefundStatus::class,
            'amount_minor' => 'integer',
            'revoke_entitlements' => 'boolean',
            'decided_at' => 'datetime',
            'processed_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
