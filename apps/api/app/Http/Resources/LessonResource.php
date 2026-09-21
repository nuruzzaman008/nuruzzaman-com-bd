<?php

namespace App\Http\Resources;

use App\Enums\LessonType;
use App\Support\DocumentLink;
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

    /**
     * What a learner sees follows the lesson type:
     * - video: the player and the text; the video file itself is not listed
     *   as a download, though other files added to the lesson are;
     * - text ("files + text"): the text and every file, and no player;
     * - download: the files only. Text saved on it is kept, not shown.
     */
    public function toArray(Request $request): array
    {
        $type = $this->type;

        return [
            'slug' => $this->slug,
            'title' => RequestLocale::pick($request, $this->title, $this->title_en),
            'type' => $this->type->value,
            'body_html' => $type === LessonType::Download ? null : Markdown::toHtml($this->body_markdown),
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
            'assets' => $this->whenLoaded('assets', fn () => $this->assets->reject(
                fn ($asset) => $asset->playsAsVideoIn($this->resource),
            )->map(fn ($asset) => [
                'id' => $asset->id,
                'title' => $asset->title,
                'size_bytes' => $asset->size_bytes,
                'checksum_sha256' => $asset->checksum_sha256,
                'kind' => $asset->isLink() ? 'link' : 'file',
                // Only the service's name; the address is reached through download_url.
                'provider' => $asset->isLink() ? DocumentLink::provider($asset->storage_path) : null,
                'download_url' => '/api/v1/learn/'.rawurlencode($this->course->slug).'/lessons/'.rawurlencode($this->slug).'/assets/'.$asset->id,
            ])->values()),
            // Expiring descriptor; the private source URL is never included.
            // Only a video lesson has a player.
            'playback' => $type === LessonType::Video ? $this->playback : null,
            'quiz_id' => $this->whenLoaded('quiz', fn () => $this->quiz?->id),
            'assignment_id' => $this->whenLoaded('assignment', fn () => $this->assignment?->id),
        ];
    }
}
