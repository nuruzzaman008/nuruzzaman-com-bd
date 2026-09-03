<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SeoMeta */
class SeoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'meta_title' => $this->meta_title,
            'meta_description' => $this->meta_description,
            'focus_keyword' => $this->focus_keyword,
            'canonical_url' => $this->canonical_url,
            'og_image_url' => $this->whenLoaded('ogImage', fn () => $this->ogImage?->url()),
            'noindex' => (bool) $this->noindex,
            'nofollow' => (bool) $this->nofollow,
        ];
    }
}
