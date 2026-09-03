<?php

namespace App\Http\Resources;

use App\Support\Markdown;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Product */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            // Staff need the primary key to build admin links; the public
            // API is addressed by slug and has no use for it.
            'id' => $this->when(
                (bool) $request->user()?->hasPermission('products.view'),
                fn () => $this->id,
            ),
            'slug' => $this->slug,
            'type' => $this->type->value,
            'name' => $this->name,
            'tagline' => $this->tagline,
            'description_html' => Markdown::toHtml($this->description_markdown),
            'cover_url' => $this->whenLoaded('cover', fn () => $this->cover?->url()),
            'cover_alt' => $this->whenLoaded('cover', fn () => $this->cover?->alt_text),
            'feature_groups' => $this->feature_groups ?? [],
            'specs' => $this->specs ?? [],
            'variants' => ProductVariantResource::collection($this->whenLoaded('activeVariants')),
            'published_at' => $this->published_at?->toIso8601String(),
            'seo' => new SeoResource($this->whenLoaded('seo')),
        ];
    }
}
