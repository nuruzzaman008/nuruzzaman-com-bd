<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SupportTicket */
class SupportTicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isStaff = (bool) $request->user()?->hasPermission('support.manage');

        return [
            'reference' => $this->reference,
            'subject' => $this->subject,
            'category' => $this->category,
            'status' => $this->status->value,
            'priority' => $this->priority,
            'order_number' => $this->whenLoaded('order', fn () => $this->order?->number),
            'created_at' => $this->created_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'messages' => $this->whenLoaded('messages', fn () => $this->messages
                // Internal notes stay inside the admin surface.
                ->filter(fn ($message) => $isStaff || ! $message->is_internal)
                ->map(fn ($message) => [
                    'id' => $message->id,
                    'author_kind' => $message->author_kind,
                    'body' => $message->body,
                    'is_internal' => (bool) $message->is_internal,
                    'at' => $message->created_at?->toIso8601String(),
                ])->values()),
        ];
    }
}
