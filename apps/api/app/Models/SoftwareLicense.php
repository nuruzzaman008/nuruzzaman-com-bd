<?php

namespace App\Models;

use App\Enums\LicenseStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SoftwareLicense extends Model
{
    protected $fillable = [
        'license_code', 'user_id', 'order_id', 'order_item_id', 'product_name',
        'status', 'device_limit', 'issued_at', 'expires_at', 'revoked_at', 'revoked_reason',
    ];

    protected function casts(): array
    {
        return [
            'status' => LicenseStatus::class,
            'issued_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function machineBindings(): HasMany
    {
        return $this->hasMany(MachineBinding::class);
    }

    public function activationRequests(): HasMany
    {
        return $this->hasMany(ActivationRequest::class);
    }

    public function getRouteKeyName(): string
    {
        return 'license_code';
    }
}
