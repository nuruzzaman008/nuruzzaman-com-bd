<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Lesson */
class LessonSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'title' => $this->title,
            'type' => $this->type->value,
            'duration_seconds' => $this->duration_seconds,
            'is_free_preview' => (bool) $this->is_free_preview,
            'position' => $this->position,
        ];
    }
}
