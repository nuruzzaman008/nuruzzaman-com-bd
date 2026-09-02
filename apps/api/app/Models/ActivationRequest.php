<?php

namespace App\Models;

use App\Enums\ActivationRequestStatus;
use App\Support\MachineIdentifier;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ActivationRequest extends Model
{
    protected $fillable = [
        'reference', 'user_id', 'order_id', 'software_license_id', 'status',
        'request_type', 'machine_id_encrypted', 'machine_id_fingerprint',
        'machine_id_masked', 'autocad_version', 'windows_version', 'customer_note',
        'vendor_response', 'internal_note', 'assigned_to', 'decided_by',
        'decided_at', 'completed_at',
    ];

    protected $hidden = ['machine_id_encrypted', 'internal_note'];

    protected function casts(): array
    {
        return [
            'status' => ActivationRequestStatus::class,
            'machine_id_encrypted' => 'encrypted',
            'decided_at' => 'datetime',
            'completed_at' => 'datetime',
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

    public function license(): BelongsTo
    {
        return $this->belongsTo(SoftwareLicense::class, 'software_license_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(ActivationRequestEvent::class)->orderBy('id');
    }

    public function setMachineId(string $machineId): void
    {
        $this->machine_id_encrypted = $machineId;
        $this->machine_id_fingerprint = MachineIdentifier::fingerprint($machineId);
        $this->machine_id_masked = MachineIdentifier::mask($machineId);
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }
}
