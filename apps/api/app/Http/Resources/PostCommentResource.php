<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A reader's comment as the public page sees it.
 *
 * Deliberately thin. No email, no user id, no IP: the page needs a name, what
 * they wrote, an optional rating and when. Anything else would be personal data
 * leaving the server for no reason.
 *
 * @mixin \App\Models\PostComment
 */
class PostCommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'author_name' => $this->author_name,
            'body' => $this->body,
            'rating' => $this->rating,
            'created_at' => $this->created_at?->toIso8601String(),
            // Staff see the queue; a reader only ever receives approved rows.
            'status' => $this->when(
                (bool) $request->user()?->hasPermission('comments.moderate'),
                fn () => $this->status->value,
            ),
            'post' => $this->when(
                (bool) $request->user()?->hasPermission('comments.moderate'),
                fn () => [
                    'slug' => $this->post?->slug,
                    'title' => $this->post?->title,
                ],
            ),
        ];
    }
}
