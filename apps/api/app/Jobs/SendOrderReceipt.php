<?php

namespace App\Jobs;

use App\Mail\OrderReceiptMail;
use App\Models\Order;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

class SendOrderReceipt implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [30, 120];

    public function __construct(public readonly int $orderId) {}

    public function handle(): void
    {
        $order = Order::query()->with(['items', 'user', 'invoice'])->find($this->orderId);

        if (! $order || blank($order->billing_email)) {
            return;
        }

        Mail::to($order->billing_email)->send(new OrderReceiptMail($order));
    }
}
