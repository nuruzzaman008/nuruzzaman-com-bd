<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SoftwareLicense */
class SoftwareLicenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'license_code' => $this->license_code,
            'product_name' => $this->product_name,
            'status' => $this->status->value,
            'device_limit' => (int) $this->device_limit,
            'issued_at' => $this->issued_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'order_number' => $this->whenLoaded('order', fn () => $this->order?->number),
            'machines' => $this->whenLoaded('machineBindings', fn () => $this->machineBindings->map(fn ($binding) => [
                'machine_id_masked' => $binding->machine_id_masked,
                'label' => $binding->label,
                'bound_at' => $binding->bound_at?->toIso8601String(),
                'released_at' => $binding->released_at?->toIso8601String(),
            ])->values()),
        ];
    }
}
