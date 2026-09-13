<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Price */
class PriceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isOffer = $this->compare_at_minor && $this->compare_at_minor > $this->amount_minor;

        return [
            'currency' => $this->currency,
            'amount_minor' => (int) $this->amount_minor,
            'compare_at_minor' => $this->compare_at_minor ? (int) $this->compare_at_minor : null,
            // When a discounted price stops applying, so the page can count
            // down to it. Pages are cached for a few minutes; this lets them
            // show the regular price the moment the offer is over.
            'offer_ends_at' => $isOffer ? $this->ends_at?->toIso8601String() : null,
        ];
    }
}
