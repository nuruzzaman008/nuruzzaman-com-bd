<?php

namespace App\Http\Resources;

use App\Support\Markdown;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\CourseAnnouncement */
class CourseAnnouncementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body_html' => Markdown::toHtml($this->body_markdown),
            'author_name' => $this->whenLoaded('author', fn () => $this->author?->name),
            'published_at' => $this->published_at?->toIso8601String(),
        ];
    }
}
