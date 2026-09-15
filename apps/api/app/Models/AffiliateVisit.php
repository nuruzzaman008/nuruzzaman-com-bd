<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One visitor arriving through a referral link. The visitor is kept only as a
 * keyed hash of their address, browser and the day - enough to count them
 * once, not enough to identify them.
 */
class AffiliateVisit extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['affiliate_id', 'visitor_hash', 'landing_path'];

    public function affiliate(): BelongsTo
    {
        return $this->belongsTo(Affiliate::class);
    }
}
