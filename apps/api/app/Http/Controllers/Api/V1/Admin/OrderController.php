<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Jobs\FulfillOrder;
use App\Models\Order;
use App\Services\Commerce\OrderStateMachine;
use App\Support\Audit;
use App\Support\ListFilters;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    public function __construct(private readonly OrderStateMachine $states) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Order::class);

        $validated = $request->validate([
            'status' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', OrderStatus::values())],
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'month' => ['sometimes', 'nullable', 'string', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        // An order is filed under the month it was placed.
        $filed = 'COALESCE(placed_at, created_at)';
        $month = $validated['month'] ?? null;

        // Without the status or the month: those two are what the filters count.
        $base = Order::query()
            ->when($validated['q'] ?? null, fn ($query, $term) => $query->where(fn ($inner) => $inner
                ->where('number', 'like', '%'.$term.'%')
                ->orWhere('billing_email', 'like', '%'.$term.'%')
                ->orWhere('billing_name', 'like', '%'.$term.'%')));

        $orders = ListFilters::month($base->clone(), $month, $filed)
            ->with(['items', 'user:id,name,email'])
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->latest('id')
            ->paginate($validated['per_page'] ?? 25)
            ->withQueryString();

        return OrderResource::collection($orders)->additional([
            'filters' => [
                'counts' => ListFilters::statusCounts(ListFilters::month($base->clone(), $month, $filed), OrderStatus::values()),
                'months' => ListFilters::months($base->clone(), $filed),
            ],
        ]);
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
    /**
     * Deletes an order that never took money: an abandoned checkout, a failed
     * or cancelled attempt, a test that stopped at the payment page.
     *
     * An order that did take money is a financial record. Deleting it would take
     * its payment, its invoice and its refunds with it - the database cascades
     * them - and leave the accounts unable to say where the money came from, so
     * it is refused here with the reason. A payment someone submitted by hand
     * and is waiting to be checked counts as money too.
     */
    public function destroy(string $number): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $order = Order::query()->where('number', $number)->firstOrFail();

        $unpaid = [OrderStatus::Draft, OrderStatus::PendingPayment, OrderStatus::Failed, OrderStatus::Cancelled];

        $reason = match (true) {
            ! in_array($order->status, $unpaid, true) => "is {$order->status->value}",
            $order->payments()->exists() => 'has a payment recorded against it',
            DB::table('manual_payment_submissions')->where('order_id', $order->id)->exists() => 'has a payment submitted for checking',
            DB::table('affiliate_commissions')->where('order_id', $order->id)->exists() => 'has earned an affiliate commission',
            default => null,
        };

        if ($reason !== null) {
            throw DomainException::conflict(
                "Order {$order->number} {$reason}, so it is kept as a financial record. Only an order that never took money can be deleted."
            );
        }

        Audit::record('order.deleted', $order, [
            'number' => $order->number,
            'status' => $order->status->value,
            'total_minor' => (int) $order->total_minor,
            'billing_email' => $order->billing_email,
        ]);

        // Its lines and status history go with it; nothing else points at an unpaid order.
        $order->delete();

        return response()->json(['message' => 'Order deleted.']);
    }

    public function transition(Request $request, string $number): OrderResource
    {
        $this->authorize('manage', Order::class);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', OrderStatus::values())],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $order = Order::query()->where('number', $number)->firstOrFail();
        $target = OrderStatus::from($validated['status']);

        DB::transaction(function () use ($order, $target, $validated, $request) {
            Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            abort_if(in_array($target, [OrderStatus::Paid, OrderStatus::Fulfilled], true)
                && DB::table('manual_payment_submissions')->where('order_id', $order->id)->exists()
                && ! DB::table('manual_payment_submissions')->where('order_id', $order->id)->where('status', 'approved')->exists(), 422, 'Review the submitted payment in Payment verification first.');
            $this->states->transition($order, $target, $validated['reason'], $request->user());
        });

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
