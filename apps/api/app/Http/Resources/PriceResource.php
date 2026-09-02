<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Price */
class PriceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'currency' => $this->currency,
            'amount_minor' => (int) $this->amount_minor,
            'compare_at_minor' => $this->compare_at_minor ? (int) $this->compare_at_minor : null,
        ];
    }
}
