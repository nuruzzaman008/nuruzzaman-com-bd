<?php

namespace App\Http\Resources;

use App\Support\Markdown;
use App\Support\RequestLocale;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Product */
class ProductResource extends JsonResource
{
    /**
     * `?locale=en` returns the English copy where it exists.
     *
     * Only the prose varies by language; the price, the variants and the
     * licensing terms are the same product either way. When no English copy
     * has been written, the Bengali is returned and `copy_translated` says
     * so, so the page can tell the reader rather than quietly showing a
     * language they did not ask for.
     */
    public function toArray(Request $request): array
    {
        $english = $request->query('locale') === 'en';
        $hasEnglish = $english && filled($this->description_markdown_en);

        return [
            // Staff need the primary key to build admin links; the public
            // API is addressed by slug and has no use for it.
            'id' => $this->when(
                (bool) $request->user()?->hasPermission('products.view'),
                fn () => $this->id,
            ),
            'slug' => $this->slug,
            'type' => $this->type->value,
            'name' => RequestLocale::pick($request, $this->name, $this->name_en),
            'tagline' => $english ? ($this->tagline_en ?? $this->tagline) : $this->tagline,
            'description_html' => Markdown::toHtml(
                $hasEnglish ? $this->description_markdown_en : $this->description_markdown,
            ),
            'copy_translated' => ! $english || $hasEnglish,
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
