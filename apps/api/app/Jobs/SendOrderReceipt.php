<?php

namespace App\Jobs;

use App\Mail\OrderReceiptMail;
use App\Models\Order;
use App\Services\Receipts\MoneyReceipt;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;
use Throwable;

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

        // The money receipt goes with it. If drawing it fails, the email is
        // still worth sending; the receipt can be downloaded from the account.
        try {
            app(MoneyReceipt::class)->ensureFor($order);
        } catch (Throwable $exception) {
            report($exception);
        }

        Mail::to($order->billing_email)->send(new OrderReceiptMail($order->fresh(['items', 'user', 'invoice'])));
    }
}
