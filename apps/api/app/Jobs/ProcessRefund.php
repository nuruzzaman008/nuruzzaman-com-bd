<?php

namespace App\Jobs;

use App\Enums\OrderStatus;
use App\Enums\RefundStatus;
use App\Models\Refund;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Fulfillment\RevocationService;
use App\Services\Payments\PaymentGateway;
use App\Support\Audit;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class ProcessRefund implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [60, 300];

    public function __construct(public readonly int $refundId) {}

    public function handle(
        PaymentGateway $gateway,
        OrderStateMachine $states,
        RevocationService $revocation,
    ): void {
        $refund = Refund::query()->with(['order.user', 'payment'])->find($this->refundId);

        if (! $refund || $refund->status !== RefundStatus::Approved) {
            return;
        }

        $result = $refund->payment
            ? $gateway->refund($refund->payment, $refund->amount_minor, $refund->reason ?? 'Customer refund')
            : null;

        if ($result && ! $result->accepted) {
            Audit::record('refund.gateway_rejected', $refund, ['error' => $result->error]);

            $refund->update(['status' => RefundStatus::Rejected, 'decided_at' => now()]);

            return;
        }

        DB::transaction(function () use ($refund, $result, $states) {
            $refund->update([
                'status' => RefundStatus::Processed,
                'gateway_refund_id' => $result?->refundReference,
                'processed_at' => now(),
            ]);

            $order = $refund->order;
            $order->increment('refunded_minor', $refund->amount_minor);
            $order->refresh();

            $states->transition(
                $order,
                $order->refunded_minor >= $order->total_minor
                    ? OrderStatus::Refunded
                    : OrderStatus::PartiallyRefunded,
                'Refund processed',
            );
        });

        if ($refund->revoke_entitlements) {
            $revocation->revokeForOrder($refund->order, 'Order refunded');
        }

        Audit::record('refund.processed', $refund, ['amount_minor' => $refund->amount_minor]);
    }
}
