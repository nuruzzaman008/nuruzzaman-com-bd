<?php

namespace App\Http\Resources;

use App\Support\Markdown;
use App\Support\RequestLocale;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The authenticated lesson payload. It is only ever built after the API has
 * confirmed an enrolment (or that the lesson is a free preview).
 *
 * @mixin \App\Models\Lesson
 */
class LessonResource extends JsonResource
{
    public function __construct($resource, private readonly ?array $playback = null)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'title' => RequestLocale::pick($request, $this->title, $this->title_en),
            'type' => $this->type->value,
            'body_html' => Markdown::toHtml($this->body_markdown),
            'duration_seconds' => $this->duration_seconds,
            'is_free_preview' => (bool) $this->is_free_preview,
            'position' => $this->position,
            'course' => [
                'slug' => $this->whenLoaded('course', fn () => $this->course?->slug),
                'title' => $this->whenLoaded(
                    'course',
                    fn () => RequestLocale::pick($request, $this->course?->title, $this->course?->title_en),
                ),
            ],
            'assets' => $this->whenLoaded('assets', fn () => $this->assets->map(fn ($asset) => [
                'id' => $asset->id,
                'title' => $asset->title,
                'size_bytes' => $asset->size_bytes,
                'checksum_sha256' => $asset->checksum_sha256,
            ])->values()),
            // Expiring descriptor; the private source URL is never included.
            'playback' => $this->playback,
            'quiz_id' => $this->whenLoaded('quiz', fn () => $this->quiz?->id),
            'assignment_id' => $this->whenLoaded('assignment', fn () => $this->assignment?->id),
        ];
    }
}
