<?php

namespace App\Models;

use App\Support\MachineIdentifier;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MachineBinding extends Model
{
    protected $fillable = [
        'software_license_id', 'machine_id_encrypted', 'machine_id_fingerprint',
        'machine_id_masked', 'label', 'bound_at', 'released_at',
    ];

    /** The encrypted value never leaves the server. */
    protected $hidden = ['machine_id_encrypted'];

    protected function casts(): array
    {
        return [
            'machine_id_encrypted' => 'encrypted',
            'bound_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    public function license(): BelongsTo
    {
        return $this->belongsTo(SoftwareLicense::class, 'software_license_id');
    }

    /** Stores the machine id encrypted, plus a searchable hash and a masked label. */
    public function setMachineId(string $machineId): void
    {
        $this->machine_id_encrypted = $machineId;
        $this->machine_id_fingerprint = MachineIdentifier::fingerprint($machineId);
        $this->machine_id_masked = MachineIdentifier::mask($machineId);
    }
}
