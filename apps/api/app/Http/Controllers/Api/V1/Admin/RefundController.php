<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Enums\RefundStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Jobs\ProcessRefund;
use App\Models\Order;
use App\Models\Refund;
use App\Services\Commerce\OrderStateMachine;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RefundController extends Controller
{
    public function __construct(private readonly OrderStateMachine $states) {}

    public function store(Request $request, string $number): JsonResponse
    {
        $order = Order::query()->where('number', $number)->with('payments')->firstOrFail();
        $this->authorize('refund', $order);

        $validated = $request->validate([
            'amount_minor' => ['required', 'integer', 'min:1', 'max:'.max(1, $this->refundable($order))],
            'reason' => ['required', 'string', 'max:512'],
            'revoke_entitlements' => ['sometimes', 'boolean'],
        ]);

        $refund = DB::transaction(function () use ($order, $validated, $request) {
            // Two refund requests at once each saw the whole total as available.
            /** @var Order $locked */
            $locked = Order::query()->with('payments')->lockForUpdate()->findOrFail($order->getKey());

            // Only money that was taken can be given back.
            if (! $locked->status->grantsEntitlements()) {
                throw DomainException::conflict("Order {$locked->number} is {$locked->status->value}, so there is no payment to refund.");
            }

            $refundable = $this->refundable($locked);

            if ($validated['amount_minor'] > $refundable) {
                throw ValidationException::withMessages([
                    'amount_minor' => "At most {$refundable} can still be refunded: refunds already requested or approved count against the total.",
                ]);
            }

            $settled = $locked->payments->firstWhere(fn ($payment) => $payment->status->isSettled());

            $refund = Refund::create([
                'order_id' => $locked->getKey(),
                'payment_id' => $settled?->getKey(),
                'requested_by' => $request->user()->getKey(),
                'status' => RefundStatus::Requested,
                'amount_minor' => $validated['amount_minor'],
                'reason' => $validated['reason'],
                'revoke_entitlements' => $validated['revoke_entitlements'] ?? true,
            ]);

            if ($locked->status->allows(OrderStatus::RefundPending)) {
                $this->states->transition($locked, OrderStatus::RefundPending, 'Refund requested', $request->user());
            }

            return $refund;
        });

        Audit::record('refund.requested', $refund, ['amount_minor' => $refund->amount_minor]);

        return response()->json(['data' => $refund], 201);
    }

    /**
     * What is left to refund: the total, less what has been refunded and what
     * is already on its way back. Only processed refunds reach refunded_minor,
     * so counting those alone let requests pile up past the amount paid.
     */
    private function refundable(Order $order): int
    {
        $outstanding = (int) Refund::query()
            ->where('order_id', $order->getKey())
            ->whereIn('status', [RefundStatus::Requested->value, RefundStatus::Approved->value])
            ->sum('amount_minor');

        return max(0, $order->total_minor - $order->refunded_minor - $outstanding);
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
