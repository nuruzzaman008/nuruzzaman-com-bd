<?php

namespace App\Http\Resources;

use App\Support\RequestLocale;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Product */
class ProductSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $variants = $this->relationLoaded('activeVariants') ? $this->activeVariants : collect();
        $prices = $variants->map(fn ($variant) => $variant->currentPrice())->filter();

        return [
            'slug' => $this->slug,
            'type' => $this->type->value,
            'name' => RequestLocale::pick($request, $this->name, $this->name_en),
            'tagline' => RequestLocale::pick($request, $this->tagline, $this->tagline_en),
            'cover_url' => $this->whenLoaded('cover', fn () => $this->cover?->url()),
            'from_price' => $prices->isNotEmpty()
                ? new PriceResource($prices->sortBy('amount_minor')->first())
                : null,
            'variant_count' => $variants->count(),
        ];
    }
}
