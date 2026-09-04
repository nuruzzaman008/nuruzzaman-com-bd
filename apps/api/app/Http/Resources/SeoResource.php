<?php

namespace App\Http\Resources;

use App\Support\RequestLocale;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SeoMeta */
class SeoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            // An SEO override beats the content's own title, so on an English
            // page it has to be the English override or nothing - otherwise the
            // Bengali headline ends up in the tab and in the search result of a
            // page that is otherwise entirely translated.
            'meta_title' => RequestLocale::isEnglish($request)
                ? $this->meta_title_en
                : $this->meta_title,
            'meta_description' => RequestLocale::isEnglish($request)
                ? $this->meta_description_en
                : $this->meta_description,
            'focus_keyword' => $this->focus_keyword,
            'canonical_url' => $this->canonical_url,
            'og_image_url' => $this->whenLoaded('ogImage', fn () => $this->ogImage?->url()),
            'noindex' => (bool) $this->noindex,
            'nofollow' => (bool) $this->nofollow,
        ];
    }
}
