<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ProductVariant */
class ProductVariantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $price = $this->relationLoaded('prices') ? $this->currentPrice() : null;

        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'name' => $this->name,
            'description' => $this->description,
            'credit_amount' => $this->credit_amount,
            'license_term_days' => $this->license_term_days,
            'device_limit' => $this->device_limit,
            'access_duration_days' => $this->access_duration_days,
            'course_slug' => $this->whenLoaded('course', fn () => $this->course?->slug),
            // Null price is an honest "contact for price" state, never zero.
            'price' => $price ? new PriceResource($price) : null,
            'is_purchasable' => (bool) $this->is_active && $price !== null,
        ];
    }
}
