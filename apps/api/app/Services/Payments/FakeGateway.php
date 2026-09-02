<?php

namespace App\Services\Payments;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * A local stand-in for SSLCOMMERZ used in development and in tests, so the
 * whole checkout, IPN, fulfilment and refund path can be exercised without
 * credentials. It is bound only when SSLCOMMERZ_DRIVER=fake.
 *
 * The hosted page it points at is a route inside this API that mimics the
 * gateway's success/fail/cancel behaviour.
 */
class FakeGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'sslcommerz';
    }

    public function createSession(Order $order, Payment $payment): GatewaySession
    {
        $sessionKey = 'fake_'.Str::random(24);

        // Remember what a valid settlement should look like so validateTransaction
        // can reject amount or currency tampering exactly like the real gateway.
        Cache::put($this->cacheKey($payment->reference), [
            'amount_minor' => $payment->amount_minor,
            'currency' => $payment->currency,
            'session_key' => $sessionKey,
        ], now()->addHours(2));

        $url = rtrim((string) config('app.url'), '/')
            .'/api/v1/payments/sandbox/'.$payment->reference;

        return new GatewaySession($url, $sessionKey, ['driver' => 'fake']);
    }

    public function validateTransaction(Payment $payment, array $callback): GatewayValidation
    {
        $expected = Cache::get($this->cacheKey($payment->reference));

        if (! $expected) {
            return GatewayValidation::failed('No sandbox session exists for this reference.', $callback);
        }

        if (($callback['val_id'] ?? null) === null) {
            return GatewayValidation::failed('The callback did not carry a val_id to verify.', $callback);
        }

        $status = strtoupper((string) ($callback['status'] ?? 'FAILED'));
        $amountMinor = isset($callback['amount'])
            ? (int) round(((float) $callback['amount']) * 100)
            : $expected['amount_minor'];
        $currency = strtoupper((string) ($callback['currency'] ?? $expected['currency']));

        $errors = [];

        if ($status !== 'VALID') {
            $errors[] = 'Gateway status is '.$status.'.';
        }

        if (($callback['tran_id'] ?? null) !== $payment->reference) {
            $errors[] = 'Transaction reference does not match this payment.';
        }

        if ($amountMinor !== $payment->amount_minor) {
            $errors[] = 'Settled amount does not match the order total.';
        }

        if ($currency !== strtoupper($payment->currency)) {
            $errors[] = 'Settled currency does not match the order currency.';
        }

        return new GatewayValidation(
            isValid: $errors === [],
            status: $status,
            transactionId: $callback['bank_tran_id'] ?? $payment->reference,
            bankTransactionId: $callback['bank_tran_id'] ?? 'SANDBOX-'.$payment->reference,
            amountMinor: $amountMinor,
            currency: $currency,
            riskLevel: isset($callback['risk_level']) ? (string) $callback['risk_level'] : '0',
            riskTitle: $callback['risk_title'] ?? null,
            cardType: $callback['card_type'] ?? 'SANDBOX',
            error: $errors ? implode(' ', $errors) : null,
            raw: $callback,
        );
    }

    public function refund(Payment $payment, int $amountMinor, string $reason): GatewayRefund
    {
        return new GatewayRefund(true, 'SANDBOX-REFUND-'.Str::random(10), raw: ['driver' => 'fake']);
    }

    private function cacheKey(string $reference): string
    {
        return 'fake-gateway:'.$reference;
    }
}
