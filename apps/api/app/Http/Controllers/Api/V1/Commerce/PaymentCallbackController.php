<?php

namespace App\Http\Controllers\Api\V1\Commerce;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\Payments\PaymentProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Gateway callbacks.
 *
 * The IPN endpoint is the one that settles money. The browser return URLs only
 * ask "what is the state of this reference now?" and never change an order.
 */
class PaymentCallbackController extends Controller
{
    public function __construct(private readonly PaymentProcessor $payments) {}

    public function ipn(Request $request): JsonResponse
    {
        $allowlist = config('sslcommerz.ipn_allowlist');

        if ($allowlist && ! in_array($request->ip(), $allowlist, true)) {
            Log::warning('Rejected an IPN from an unexpected source address.', ['ip' => $request->ip()]);

            return response()->json(['status' => 'ignored'], 202);
        }

        $event = $this->payments->handleCallback('ipn', $request->all(), $request->ip());

        // Always 200: the gateway must not retry forever because our own
        // validation rejected a callback. The stored event records the outcome.
        return response()->json([
            'status' => $event->is_valid ? 'accepted' : 'rejected',
            'reference' => $request->input('tran_id'),
        ]);
    }

    /**
     * Read-only status lookup used by the /checkout/result pages. Landing here
     * grants nothing; the customer sees "confirming" until the IPN lands.
     */
    public function status(Request $request, string $reference): JsonResponse
    {
        $payment = Payment::query()
            ->where('reference', $reference)
            ->with('order')
            ->firstOrFail();

        abort_unless(
            $request->user() && $payment->order->user_id === $request->user()->getKey(),
            403,
            'This payment does not belong to you.',
        );

        return response()->json([
            'data' => [
                'reference' => $payment->reference,
                'payment_status' => $payment->status->value,
                'order_number' => $payment->order->number,
                'order_status' => $payment->order->status->value,
                'is_settled' => $payment->status->isSettled(),
                'needs_review' => $payment->status->value === 'risk_hold',
            ],
        ]);
    }

    /**
     * Sandbox stand-in for the hosted payment page. Only reachable while the
     * fake gateway driver is bound, so it cannot exist in production.
     */
    public function sandbox(Request $request, string $reference): RedirectResponse|JsonResponse
    {
        abort_unless(config('sslcommerz.driver') !== 'sslcommerz', 404);

        $payment = Payment::query()->where('reference', $reference)->firstOrFail();
        $outcome = $request->query('outcome', 'success');

        if ($outcome === 'success') {
            $this->payments->handleCallback('ipn', [
                'tran_id' => $payment->reference,
                'val_id' => 'SANDBOX-'.$payment->reference,
                'status' => 'VALID',
                'amount' => number_format($payment->amount_minor / 100, 2, '.', ''),
                'currency' => $payment->currency,
                'bank_tran_id' => 'SANDBOX-BANK-'.$payment->reference,
                'risk_level' => $request->query('risk', '0'),
                'card_type' => 'SANDBOX',
            ], $request->ip());
        } elseif ($outcome === 'failed') {
            $this->payments->handleCallback('ipn', [
                'tran_id' => $payment->reference,
                'val_id' => 'SANDBOX-'.$payment->reference,
                'status' => 'FAILED',
            ], $request->ip());
        }

        $target = match ($outcome) {
            'success' => config('sslcommerz.urls.success'),
            'cancelled' => config('sslcommerz.urls.cancel'),
            default => config('sslcommerz.urls.fail'),
        };

        return redirect()->away(
            rtrim((string) config('nb.site.url'), '/').$target.'?ref='.$payment->reference
        );
    }
}
