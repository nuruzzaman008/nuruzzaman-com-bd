<?php

namespace App\Services\Commerce;

use App\Enums\OrderStatus;
use App\Exceptions\DomainException;
use App\Models\Order;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

/**
 * The only place an order status changes. Every transition is validated against
 * the state machine and recorded as an order status event plus an audit row.
 */
class OrderStateMachine
{
    public function transition(Order $order, OrderStatus $to, ?string $reason = null, ?User $actor = null): Order
    {
        return DB::transaction(function () use ($order, $to, $reason, $actor) {
            /** @var Order $locked */
            $locked = Order::query()->lockForUpdate()->findOrFail($order->getKey());
            $from = $locked->status;

            if ($from === $to) {
                return $locked;
            }

            if (! $from->allows($to)) {
                throw DomainException::conflict(
                    "Order {$locked->number} cannot move from {$from->value} to {$to->value}."
                );
            }

            $locked->status = $to;
            $this->stampTimestamps($locked, $to);
            $locked->save();

            $locked->statusEvents()->create([
                'from_status' => $from->value,
                'to_status' => $to->value,
                'reason' => $reason,
                'actor_id' => $actor?->getKey(),
            ]);

            Audit::record('order.status_changed', $locked, [
                'from' => $from->value,
                'to' => $to->value,
                'reason' => $reason,
            ], $actor?->getKey());

            return $locked;
        });
    }

    /** True when the transition is legal, without performing it. */
    public function canTransition(Order $order, OrderStatus $to): bool
    {
        return $order->status->allows($to);
    }

    private function stampTimestamps(Order $order, OrderStatus $to): void
    {
        match ($to) {
            OrderStatus::PendingPayment => $order->placed_at ??= now(),
            OrderStatus::Paid => $order->paid_at ??= now(),
            OrderStatus::Fulfilled => $order->fulfilled_at ??= now(),
            OrderStatus::Cancelled, OrderStatus::Failed => $order->cancelled_at ??= now(),
            default => null,
        };
    }
}
