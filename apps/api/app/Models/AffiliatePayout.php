<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Money the owner sent an affiliate - by bKash, bank or otherwise, outside the
 * site - recorded here so both sides see the same balance.
 */
class AffiliatePayout extends Model
{
    protected $fillable = [
        'affiliate_id', 'amount_minor', 'currency', 'method', 'reference', 'note', 'paid_at', 'recorded_by',
    ];

    protected function casts(): array
    {
        return ['amount_minor' => 'integer', 'paid_at' => 'datetime'];
    }

    public function affiliate(): BelongsTo
    {
        return $this->belongsTo(Affiliate::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
