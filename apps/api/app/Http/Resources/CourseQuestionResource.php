<?php

namespace App\Http\Resources;

use App\Enums\ContentStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\CourseQuestion */
class CourseQuestionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,
            // The author needs to know their question is still in moderation;
            // for everyone else only published questions are ever returned.
            'status' => $this->status->value,
            'is_pinned' => (bool) $this->is_pinned,
            'is_mine' => $this->user_id === $request->user()?->getKey(),
            'reply_count' => (int) $this->reply_count,
            'lesson' => $this->whenLoaded('lesson', fn () => $this->lesson ? [
                'slug' => $this->lesson->slug,
                'title' => $this->lesson->title,
            ] : null),
            'author_name' => $this->whenLoaded('user', fn () => $this->user?->name),
            'answered_at' => $this->answered_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'replies' => $this->whenLoaded('replies', fn () => $this->replies
                ->where('status', ContentStatus::Published)
                ->map(fn ($reply) => [
                    'id' => $reply->id,
                    'body' => $reply->body,
                    'from_instructor' => (bool) $reply->from_instructor,
                    'author_name' => $reply->user?->name,
                    'created_at' => $reply->created_at?->toIso8601String(),
                ])->values()),
        ];
    }
}
