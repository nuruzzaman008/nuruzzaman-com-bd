<?php

namespace App\Http\Resources;

use App\Support\Markdown;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Post */
class PostSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'title' => $this->title,
            'excerpt' => $this->excerpt ?: Markdown::excerpt($this->body_markdown),
            'cover_url' => $this->whenLoaded('cover', fn () => $this->cover?->url()),
            'cover_alt' => $this->whenLoaded('cover', fn () => $this->cover?->alt_text),
            'reading_minutes' => $this->reading_minutes ?? Markdown::readingMinutes($this->body_markdown),
            'published_at' => $this->published_at?->toIso8601String(),
            'updated_at' => $this->content_updated_at?->toIso8601String(),
            'author' => new AuthorResource($this->whenLoaded('author')),
            'categories' => CategoryResource::collection($this->whenLoaded('categories')),
        ];
    }
}
