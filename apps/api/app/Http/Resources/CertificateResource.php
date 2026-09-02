<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Certificate */
class CertificateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'verification_id' => $this->verification_id,
            'recipient_name' => $this->recipient_name,
            'course_title' => $this->course_title,
            'course_slug' => $this->whenLoaded('course', fn () => $this->course?->slug),
            'score_percent' => $this->score_percent,
            'issued_at' => $this->issued_at?->toIso8601String(),
            'is_valid' => $this->isValid(),
        ];
    }
}
