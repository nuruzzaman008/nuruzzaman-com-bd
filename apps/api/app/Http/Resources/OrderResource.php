<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Order */
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'number' => $this->number,
            'status' => $this->status->value,
            'currency' => $this->currency,
            'subtotal_minor' => (int) $this->subtotal_minor,
            'discount_minor' => (int) $this->discount_minor,
            'tax_minor' => (int) $this->tax_minor,
            'total_minor' => (int) $this->total_minor,
            'refunded_minor' => (int) $this->refunded_minor,
            'billing_name' => $this->billing_name,
            'billing_email' => $this->billing_email,
            'placed_at' => $this->placed_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'fulfilled_at' => $this->fulfilled_at?->toIso8601String(),
            'accepted_terms' => $this->accepted_terms ?? [],
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'variant_name' => $item->variant_name,
                'sku' => $item->sku,
                'product_type' => $item->product_type,
                'quantity' => $item->quantity,
                'unit_price_minor' => (int) $item->unit_price_minor,
                'line_total_minor' => (int) $item->line_total_minor,
            ])->values()),
            'invoice_number' => $this->whenLoaded('invoice', fn () => $this->invoice?->number),
            'timeline' => $this->whenLoaded('statusEvents', fn () => $this->statusEvents->map(fn ($event) => [
                'from' => $event->from_status,
                'to' => $event->to_status,
                'reason' => $event->reason,
                'at' => $event->created_at?->toIso8601String(),
            ])->values()),
        ];
    }
}
