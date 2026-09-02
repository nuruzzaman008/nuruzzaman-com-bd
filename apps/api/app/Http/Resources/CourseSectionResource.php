<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\CourseSection */
class CourseSectionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'summary' => $this->summary,
            'position' => $this->position,
            'drip_days' => $this->drip_days,
            'lessons' => LessonSummaryResource::collection($this->whenLoaded('lessons')),
        ];
    }
}
