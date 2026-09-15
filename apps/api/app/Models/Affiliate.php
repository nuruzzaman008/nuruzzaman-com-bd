<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A customer who shares a referral link and earns a commission on the paid
 * orders it brings. One per user; the code is what appears in the link.
 */
class Affiliate extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUSPENDED = 'suspended';

    protected $fillable = [
        'user_id', 'code', 'status', 'commission_rate',
        'payout_method', 'payout_account', 'payout_name', 'admin_note',
    ];

    protected function casts(): array
    {
        // Null means "the program's default rate", so it is never cast to 0.
        return ['commission_rate' => 'decimal:2'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function visits(): HasMany
    {
        return $this->hasMany(AffiliateVisit::class);
    }

    public function commissions(): HasMany
    {
        return $this->hasMany(AffiliateCommission::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(AffiliatePayout::class);
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
}
