<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ActivationRequest */
class ActivationRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'status' => $this->status->value,
            'request_type' => $this->request_type,
            // Only the masked identifier is ever returned, to any role.
            'machine_id_masked' => $this->machine_id_masked,
            'autocad_version' => $this->autocad_version,
            'windows_version' => $this->windows_version,
            'customer_note' => $this->customer_note,
            'vendor_response' => $this->vendor_response,
            'order_number' => $this->whenLoaded('order', fn () => $this->order?->number),
            'license_code' => $this->whenLoaded('license', fn () => $this->license?->license_code),
            'created_at' => $this->created_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'timeline' => $this->whenLoaded('events', fn () => $this->events->map(fn ($event) => [
                'from' => $event->from_status,
                'to' => $event->to_status,
                'note' => $event->note,
                'at' => $event->created_at?->toIso8601String(),
            ])->values()),
        ];
    }
}
