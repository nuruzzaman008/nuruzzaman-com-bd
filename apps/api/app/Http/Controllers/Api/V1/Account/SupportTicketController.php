<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Enums\SupportTicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SupportTicketResource;
use App\Models\Order;
use App\Models\SupportTicket;
use App\Support\Reference;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class SupportTicketController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $tickets = $request->user()->supportTickets()
            ->with('order')
            ->latest('id')
            ->paginate(20);

        return SupportTicketResource::collection($tickets);
    }

    public function store(Request $request): SupportTicketResource
    {
        $validated = $request->validate([
            'subject' => ['required', 'string', 'min:3', 'max:255'],
            'category' => ['required', 'string', 'in:installation,activation,licence,course,billing,general'],
            'message' => ['required', 'string', 'min:10', 'max:5000'],
            'order_number' => ['nullable', 'string', 'exists:orders,number'],
        ]);

        $order = $validated['order_number'] ?? null
            ? Order::query()->where('number', $validated['order_number'])->first()
            : null;

        // A ticket may only be attached to an order the customer owns.
        if ($order && $order->user_id !== $request->user()->getKey()) {
            abort(403, 'That order does not belong to you.');
        }

        $ticket = DB::transaction(function () use ($request, $validated, $order) {
            $ticket = SupportTicket::create([
                'reference' => Reference::ticket(),
                'user_id' => $request->user()->getKey(),
                'name' => $request->user()->name,
                'email' => $request->user()->email,
                'subject' => $validated['subject'],
                'category' => $validated['category'],
                'status' => SupportTicketStatus::Open,
                'order_id' => $order?->getKey(),
            ]);

            $ticket->messages()->create([
                'author_id' => $request->user()->getKey(),
                'author_kind' => 'customer',
                'body' => $validated['message'],
            ]);

            return $ticket;
        });

        return new SupportTicketResource($ticket->load(['messages', 'order']));
    }

    public function show(Request $request, string $reference): SupportTicketResource
    {
        $ticket = SupportTicket::query()
            ->where('reference', $reference)
            ->with(['messages', 'order'])
            ->firstOrFail();

        $this->authorize('view', $ticket);

        return new SupportTicketResource($ticket);
    }

    public function reply(Request $request, string $reference): SupportTicketResource
    {
        $validated = $request->validate(['message' => ['required', 'string', 'min:2', 'max:5000']]);

        $ticket = SupportTicket::query()->where('reference', $reference)->firstOrFail();
        $this->authorize('reply', $ticket);

        $ticket->messages()->create([
            'author_id' => $request->user()->getKey(),
            'author_kind' => $request->user()->hasPermission('support.manage') ? 'staff' : 'customer',
            'body' => $validated['message'],
        ]);

        if ($ticket->status === SupportTicketStatus::Resolved) {
            $ticket->update(['status' => SupportTicketStatus::Open, 'resolved_at' => null]);
        }

        return new SupportTicketResource($ticket->fresh()->load(['messages', 'order']));
    }
}
