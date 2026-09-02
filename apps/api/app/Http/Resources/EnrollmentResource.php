<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Enrollment */
class EnrollmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'progress_percent' => (int) $this->progress_percent,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'course' => new CourseSummaryResource($this->whenLoaded('course')),
            'last_lesson_slug' => $this->whenLoaded('lastLesson', fn () => $this->lastLesson?->slug),
            'certificate_id' => $this->whenLoaded('certificate', fn () => $this->certificate?->verification_id),
        ];
    }
}
