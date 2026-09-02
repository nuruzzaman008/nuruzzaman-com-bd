<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\LessonNote */
class LessonNoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'body' => $this->body,
            'position_seconds' => $this->position_seconds,
            'lesson' => $this->whenLoaded('lesson', fn () => [
                'slug' => $this->lesson?->slug,
                'title' => $this->lesson?->title,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
