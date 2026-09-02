<?php

namespace App\Models;

use App\Enums\RefillOrderStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefillOrder extends Model
{
    protected $fillable = [
        'reference', 'user_id', 'order_id', 'software_license_id',
        'credit_amount', 'status', 'vendor_response', 'decided_by', 'issued_at',
    ];

    protected function casts(): array
    {
        return ['status' => RefillOrderStatus::class, 'issued_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function license(): BelongsTo
    {
        return $this->belongsTo(SoftwareLicense::class, 'software_license_id');
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }
}
