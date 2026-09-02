<?php

namespace App\Jobs;

use App\Models\Order;
use App\Services\Fulfillment\FulfillmentService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Dispatched after the payment transaction commits. Unique per order so a
 * duplicate IPN cannot start two fulfilment runs at once, and idempotent so a
 * retry after a partial failure finishes the job safely.
 */
class FulfillOrder implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public array $backoff = [10, 30, 120, 300];

    public function __construct(public readonly int $orderId) {}

    public function uniqueId(): string
    {
        return (string) $this->orderId;
    }

    public function handle(FulfillmentService $fulfillment): void
    {
        $order = Order::query()->with(['items.variant', 'user'])->find($this->orderId);

        if (! $order) {
            return;
        }

        $fulfillment->fulfill($order);

        SendOrderReceipt::dispatch($order->getKey());
    }
}
