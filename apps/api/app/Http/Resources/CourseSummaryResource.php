<?php

namespace App\Http\Resources;

use App\Support\CourseTracks;
use App\Support\RequestLocale;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Course */
class CourseSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'title' => RequestLocale::pick($request, $this->title, $this->title_en),
            'subtitle' => RequestLocale::pick($request, $this->subtitle, $this->subtitle_en),
            'level' => $this->level,
            'track' => $this->track,
            'track_name' => CourseTracks::name($this->track),
            'language' => $this->language,
            'cover_url' => $this->whenLoaded('cover', fn () => $this->cover?->url()),
            'estimated_minutes' => $this->estimated_minutes,
            'lesson_count' => $this->whenCounted('lessons'),
            'issues_certificate' => (bool) $this->issues_certificate,
            'published_at' => $this->published_at?->toIso8601String(),
        ];
    }
}
