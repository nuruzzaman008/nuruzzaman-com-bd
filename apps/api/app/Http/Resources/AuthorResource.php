<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Author */
class AuthorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'credentials' => $this->credentials,
            'headline' => $this->headline,
            'bio' => $this->bio,
            'photo_url' => $this->whenLoaded('photo', fn () => $this->photo?->url()),
            'same_as' => $this->same_as ?? [],
            'is_reviewer' => (bool) $this->is_reviewer,
        ];
    }
}
