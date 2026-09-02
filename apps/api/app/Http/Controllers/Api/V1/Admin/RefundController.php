<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Enums\RefundStatus;
use App\Http\Controllers\Controller;
use App\Jobs\ProcessRefund;
use App\Models\Order;
use App\Models\Refund;
use App\Services\Commerce\OrderStateMachine;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RefundController extends Controller
{
    public function __construct(private readonly OrderStateMachine $states) {}

    public function store(Request $request, string $number): JsonResponse
    {
        $order = Order::query()->where('number', $number)->with('payments')->firstOrFail();
        $this->authorize('refund', $order);

        $remaining = $order->total_minor - $order->refunded_minor;

        $validated = $request->validate([
            'amount_minor' => ['required', 'integer', 'min:1', 'max:'.max(1, $remaining)],
            'reason' => ['required', 'string', 'max:512'],
            'revoke_entitlements' => ['sometimes', 'boolean'],
        ]);

        $settled = $order->payments->firstWhere(fn ($payment) => $payment->status->isSettled());

        $refund = Refund::create([
            'order_id' => $order->getKey(),
            'payment_id' => $settled?->getKey(),
            'requested_by' => $request->user()->getKey(),
            'status' => RefundStatus::Requested,
            'amount_minor' => $validated['amount_minor'],
            'reason' => $validated['reason'],
            'revoke_entitlements' => $validated['revoke_entitlements'] ?? true,
        ]);

        if ($order->status->allows(OrderStatus::RefundPending)) {
            $this->states->transition($order, OrderStatus::RefundPending, 'Refund requested', $request->user());
        }

        Audit::record('refund.requested', $refund, ['amount_minor' => $refund->amount_minor]);

        return response()->json(['data' => $refund], 201);
    }

    /** Approval is a second, explicit step, so a refund is never one click. */
    public function approve(Request $request, Refund $refund): JsonResponse
    {
        $this->authorize('refund', $refund->order);

        abort_unless($refund->status === RefundStatus::Requested, 409, 'This refund has already been decided.');

        $refund->update([
            'status' => RefundStatus::Approved,
            'decided_by' => $request->user()->getKey(),
            'decided_at' => now(),
        ]);

        ProcessRefund::dispatch($refund->getKey());

        return response()->json(['data' => $refund->fresh()]);
    }

    public function reject(Request $request, Refund $refund): JsonResponse
    {
        $this->authorize('refund', $refund->order);

        abort_unless($refund->status === RefundStatus::Requested, 409, 'This refund has already been decided.');

        $refund->update([
            'status' => RefundStatus::Rejected,
            'decided_by' => $request->user()->getKey(),
            'decided_at' => now(),
        ]);

        // The order goes back to its pre-refund state so it is not stuck.
        $order = $refund->order;

        if ($order->status === OrderStatus::RefundPending) {
            $this->states->transition(
                $order,
                $order->fulfilled_at ? OrderStatus::Fulfilled : OrderStatus::Paid,
                'Refund rejected',
                $request->user(),
            );
        }

        return response()->json(['data' => $refund->fresh()]);
    }
}
