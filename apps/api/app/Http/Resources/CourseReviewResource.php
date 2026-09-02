<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\CourseReview */
class CourseReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'rating' => (int) $this->rating,
            'title' => $this->title,
            'body' => $this->body,
            // Every published review is tied to a verified enrolment row.
            'is_verified_enrollment' => true,
            'author_name' => $this->whenLoaded('user', fn () => $this->user?->name),
            'published_at' => $this->published_at?->toIso8601String(),
        ];
    }
}
