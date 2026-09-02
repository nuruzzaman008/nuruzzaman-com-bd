<?php

namespace App\Http\Resources;

use App\Support\Markdown;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Post */
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'status' => $this->status->value,
            'title' => $this->title,
            'excerpt' => $this->excerpt ?: Markdown::excerpt($this->body_markdown),
            // Rendered server-side with raw HTML stripped, so the frontend never
            // has to trust or sanitise author input itself.
            'body_html' => Markdown::toHtml($this->body_markdown),
            // The Markdown source is what the admin editor loads. It is only
            // included for a user who may already read drafts.
            'body_markdown' => $this->when(
                (bool) $request->user()?->hasPermission('posts.view'),
                fn () => $this->body_markdown,
            ),
            'toc' => Markdown::headings($this->body_markdown),
            'cover_url' => $this->whenLoaded('cover', fn () => $this->cover?->url()),
            'cover_alt' => $this->whenLoaded('cover', fn () => $this->cover?->alt_text),
            'reading_minutes' => $this->reading_minutes ?? Markdown::readingMinutes($this->body_markdown),
            'funnel_stage' => $this->funnel_stage,
            'published_at' => $this->published_at?->toIso8601String(),
            'updated_at' => $this->content_updated_at?->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'author' => new AuthorResource($this->whenLoaded('author')),
            'reviewer' => new AuthorResource($this->whenLoaded('reviewer')),
            'categories' => CategoryResource::collection($this->whenLoaded('categories')),
            'tags' => TagResource::collection($this->whenLoaded('tags')),
            'seo' => new SeoResource($this->whenLoaded('seo')),
        ];
    }
}
