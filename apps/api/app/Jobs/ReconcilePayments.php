<?php

namespace App\Jobs;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Services\Payments\PaymentProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Scheduled safety net for lost or delayed IPNs.
 *
 * Any payment that has been pending for a while is re-verified against the
 * gateway. Because verification and settlement run through PaymentProcessor,
 * reconciliation cannot double-fulfil an order.
 */
class ReconcilePayments implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(public readonly int $minutesOld = 15) {}

    public function handle(PaymentProcessor $processor): void
    {
        $pending = Payment::query()
            ->whereIn('status', [PaymentStatus::Initiated->value, PaymentStatus::Pending->value])
            ->where('created_at', '<=', now()->subMinutes($this->minutesOld))
            ->where('created_at', '>=', now()->subDays(7))
            ->with('order')
            ->limit(200)
            ->get();

        foreach ($pending as $payment) {
            $lastEvent = $payment->events()->latest('id')->first();

            if (! $lastEvent) {
                // Nothing ever came back: the customer most likely abandoned the
                // hosted page. Expire the attempt so the order can be retried.
                if ($payment->created_at->lt(now()->subDay())) {
                    $payment->update(['status' => PaymentStatus::Failed, 'failed_at' => now()]);

                    if ($payment->order && $payment->order->status === OrderStatus::PendingPayment) {
                        Log::info('Reconciliation expired an abandoned payment.', [
                            'payment' => $payment->reference,
                        ]);
                    }
                }

                continue;
            }

            $processor->handleCallback('reconciliation', $lastEvent->payload ?? [], null);
        }
    }
}
