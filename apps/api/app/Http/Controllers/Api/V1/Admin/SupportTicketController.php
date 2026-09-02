<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\SupportTicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SupportTicketResource;
use App\Models\SupportTicket;
use App\Support\Audit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SupportTicketController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', SupportTicket::class);

        $validated = $request->validate([
            'status' => ['sometimes', 'string', 'in:'.implode(',', SupportTicketStatus::values())],
            'category' => ['sometimes', 'string', 'max:48'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $tickets = SupportTicket::query()
            ->with(['user:id,name,email', 'order:id,number'])
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['category'] ?? null, fn ($query, $category) => $query->where('category', $category))
            ->latest('id')
            ->paginate($validated['per_page'] ?? 25);

        return SupportTicketResource::collection($tickets);
    }

    public function show(Request $request, string $reference): SupportTicketResource
    {
        $ticket = SupportTicket::query()
            ->where('reference', $reference)
            ->with(['messages', 'order', 'user'])
            ->firstOrFail();

        $this->authorize('view', $ticket);

        return new SupportTicketResource($ticket);
    }

    public function reply(Request $request, string $reference): SupportTicketResource
    {
        $ticket = SupportTicket::query()->where('reference', $reference)->firstOrFail();
        $this->authorize('manage', SupportTicket::class);

        $validated = $request->validate([
            'message' => ['required', 'string', 'min:2', 'max:5000'],
            // Internal notes are stored on the ticket but filtered out of the
            // customer-facing resource.
            'is_internal' => ['sometimes', 'boolean'],
        ]);

        $ticket->messages()->create([
            'author_id' => $request->user()->getKey(),
            'author_kind' => 'staff',
            'body' => $validated['message'],
            'is_internal' => $validated['is_internal'] ?? false,
        ]);

        if (! ($validated['is_internal'] ?? false)) {
            $ticket->update(['status' => SupportTicketStatus::Pending]);
        }

        return new SupportTicketResource($ticket->fresh()->load(['messages', 'order']));
    }

    public function update(Request $request, string $reference): SupportTicketResource
    {
        $ticket = SupportTicket::query()->where('reference', $reference)->firstOrFail();
        $this->authorize('manage', SupportTicket::class);

        $validated = $request->validate([
            'status' => ['sometimes', 'string', 'in:'.implode(',', SupportTicketStatus::values())],
            'priority' => ['sometimes', 'string', 'in:low,normal,high,urgent'],
            'assigned_to' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
        ]);

        if (($validated['status'] ?? null) === SupportTicketStatus::Resolved->value) {
            $validated['resolved_at'] = now();
        }

        $ticket->update($validated);
        Audit::record('support_ticket.updated', $ticket, $validated);

        return new SupportTicketResource($ticket->fresh()->load(['messages', 'order']));
    }
}
