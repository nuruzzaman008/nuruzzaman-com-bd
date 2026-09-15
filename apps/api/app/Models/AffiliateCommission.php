<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The commission one referred order earned. The rate and the amount it was
 * worked out on are kept, so changing the program's rate later never rewrites
 * what was already earned.
 */
class AffiliateCommission extends Model
{
    public const STATUS_EARNED = 'earned';

    public const STATUS_VOID = 'void';

    protected $fillable = [
        'affiliate_id', 'order_id', 'currency', 'base_minor', 'rate', 'amount_minor',
        'status', 'available_at', 'voided_at', 'void_reason',
    ];

    protected function casts(): array
    {
        return [
            'base_minor' => 'integer',
            'rate' => 'decimal:2',
            'amount_minor' => 'integer',
            'available_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    public function affiliate(): BelongsTo
    {
        return $this->belongsTo(Affiliate::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * What the affiliate sees: void, still inside the refund hold, or
     * available to be paid out.
     */
    public function state(): string
    {
        if ($this->status === self::STATUS_VOID) {
            return 'void';
        }

        return $this->available_at !== null && $this->available_at->isFuture() ? 'pending' : 'available';
    }
}
