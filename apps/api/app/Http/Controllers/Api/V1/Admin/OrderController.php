<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Jobs\FulfillOrder;
use App\Models\Order;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrderController extends Controller
{
    public function __construct(private readonly OrderStateMachine $states) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Order::class);

        $validated = $request->validate([
            'status' => ['sometimes', 'string', 'in:'.implode(',', OrderStatus::values())],
            'q' => ['sometimes', 'string', 'max:120'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $orders = Order::query()
            ->with(['items', 'user:id,name,email'])
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['q'] ?? null, fn ($query, $term) => $query->where(fn ($inner) => $inner
                ->where('number', 'like', '%'.$term.'%')
                ->orWhere('billing_email', 'like', '%'.$term.'%')))
            ->latest('id')
            ->paginate($validated['per_page'] ?? 25);

        return OrderResource::collection($orders);
    }

    public function show(string $number): OrderResource
    {
        $order = Order::query()
            ->where('number', $number)
            ->with(['items', 'user', 'payments.events', 'invoice', 'statusEvents', 'refunds'])
            ->firstOrFail();

        $this->authorize('view', $order);

        return new OrderResource($order);
    }

    /**
     * Manual status changes still go through the state machine, so an admin
     * cannot put an order into a state the domain does not allow.
     */
    public function transition(Request $request, string $number): OrderResource
    {
        $this->authorize('manage', Order::class);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', OrderStatus::values())],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $order = Order::query()->where('number', $number)->firstOrFail();
        $target = OrderStatus::from($validated['status']);

        $this->states->transition($order, $target, $validated['reason'], $request->user());

        if ($target === OrderStatus::Paid) {
            FulfillOrder::dispatch($order->getKey());
        }

        return new OrderResource($order->fresh()->load(['items', 'statusEvents']));
    }

    /** Re-runs fulfilment for an order whose grants need repairing. */
    public function refulfill(Request $request, string $number): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $order = Order::query()->where('number', $number)->firstOrFail();

        abort_unless($order->status->grantsEntitlements(), 422, 'This order is not in a fulfillable state.');

        FulfillOrder::dispatch($order->getKey());

        return response()->json(['message' => 'Fulfilment has been queued.']);
    }
}
