<?php

namespace App\Services\Payments;

use App\Exceptions\DomainException;
use App\Models\Order;
use App\Models\Payment;
use App\Support\Money;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Direct SSLCOMMERZ v4 integration.
 *
 * Reference: https://developer.sslcommerz.com/doc/v4/index.html
 *
 * Two rules this class exists to enforce:
 *  1. The amount sent to the gateway is the amount stored on the order.
 *  2. A payment is only ever accepted after the Order Validation API confirms
 *     the transaction id, amount, currency and status.
 */
class SslCommerzGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'sslcommerz';
    }

    public function createSession(Order $order, Payment $payment): GatewaySession
    {
        $config = $this->config();
        $frontend = rtrim((string) config('nb.site.url'), '/');
        $apiBase = rtrim((string) config('app.url'), '/');

        $response = Http::asForm()
            ->timeout((int) config('sslcommerz.timeout_seconds'))
            ->post($config['session_url'], [
                'store_id' => $config['store_id'],
                'store_passwd' => $config['store_password'],
                'total_amount' => Money::minor($payment->amount_minor, $payment->currency)->toMajorString(),
                'currency' => $payment->currency,
                'tran_id' => $payment->reference,
                'success_url' => $frontend.config('sslcommerz.urls.success').'?ref='.$payment->reference,
                'fail_url' => $frontend.config('sslcommerz.urls.fail').'?ref='.$payment->reference,
                'cancel_url' => $frontend.config('sslcommerz.urls.cancel').'?ref='.$payment->reference,
                'ipn_url' => $apiBase.config('sslcommerz.urls.ipn'),
                'cus_name' => $order->billing_name ?: 'Customer',
                'cus_email' => $order->billing_email,
                'cus_phone' => $order->billing_phone ?: 'N/A',
                'cus_add1' => 'N/A',
                'cus_city' => 'N/A',
                'cus_country' => 'Bangladesh',
                'shipping_method' => 'NO',
                'product_name' => $this->productSummary($order),
                'product_category' => 'digital',
                'product_profile' => 'digital-goods',
                'value_a' => $order->number,
            ]);

        if ($response->failed()) {
            Log::error('SSLCOMMERZ session request failed', ['status' => $response->status()]);

            throw DomainException::unavailable('The payment gateway is not reachable right now.');
        }

        $body = $response->json() ?? [];

        if (($body['status'] ?? '') !== 'SUCCESS' || blank($body['GatewayPageURL'] ?? null)) {
            Log::warning('SSLCOMMERZ refused the session', ['reason' => $body['failedreason'] ?? null]);

            throw DomainException::unavailable($body['failedreason'] ?? 'The payment gateway refused this session.');
        }

        return new GatewaySession(
            redirectUrl: $body['GatewayPageURL'],
            sessionKey: $body['sessionkey'] ?? null,
            raw: $body,
        );
    }

    public function validateTransaction(Payment $payment, array $callback): GatewayValidation
    {
        $config = $this->config();
        $valId = $callback['val_id'] ?? null;

        if (blank($valId)) {
            return GatewayValidation::failed('The callback did not carry a val_id to verify.', $callback);
        }

        $response = Http::timeout((int) config('sslcommerz.timeout_seconds'))
            ->get($config['validation_url'], [
                'val_id' => $valId,
                'store_id' => $config['store_id'],
                'store_passwd' => $config['store_password'],
                'v' => 1,
                'format' => 'json',
            ]);

        if ($response->failed()) {
            return GatewayValidation::failed('Validation request to SSLCOMMERZ failed.', ['status' => $response->status()]);
        }

        $body = $response->json() ?? [];
        $status = strtoupper((string) ($body['status'] ?? 'FAILED'));

        // The amount is compared in minor units against what we stored, so a
        // tampered redirect or a partially paid session cannot be accepted.
        $amountMinor = isset($body['amount']) ? (int) round(((float) $body['amount']) * 100) : null;
        $currency = strtoupper((string) ($body['currency_type'] ?? $body['currency'] ?? ''));

        $errors = [];

        if (! in_array($status, ['VALID', 'VALIDATED'], true)) {
            $errors[] = 'Gateway status is '.$status.'.';
        }

        if (($body['tran_id'] ?? null) !== $payment->reference) {
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
            transactionId: $body['bank_tran_id'] ?? $body['tran_id'] ?? null,
            bankTransactionId: $body['bank_tran_id'] ?? null,
            amountMinor: $amountMinor,
            currency: $currency ?: null,
            riskLevel: isset($body['risk_level']) ? (string) $body['risk_level'] : null,
            riskTitle: $body['risk_title'] ?? null,
            cardType: $body['card_type'] ?? null,
            error: $errors ? implode(' ', $errors) : null,
            raw: $body,
        );
    }

    public function refund(Payment $payment, int $amountMinor, string $reason): GatewayRefund
    {
        $config = $this->config();

        if (blank($payment->bank_transaction_id)) {
            return new GatewayRefund(false, error: 'This payment has no bank transaction id to refund against.');
        }

        $response = Http::timeout((int) config('sslcommerz.timeout_seconds'))
            ->get($config['refund_url'], [
                'bank_tran_id' => $payment->bank_transaction_id,
                'store_id' => $config['store_id'],
                'store_passwd' => $config['store_password'],
                'refund_amount' => Money::minor($amountMinor, $payment->currency)->toMajorString(),
                'refund_remarks' => mb_substr($reason, 0, 255),
                'format' => 'json',
            ]);

        $body = $response->json() ?? [];
        $accepted = in_array(strtoupper((string) ($body['status'] ?? '')), ['SUCCESS', 'PROCESSING'], true);

        return new GatewayRefund(
            accepted: $accepted,
            refundReference: $body['refund_ref_id'] ?? null,
            error: $accepted ? null : ($body['errorReason'] ?? 'The gateway did not accept this refund.'),
            raw: $body,
        );
    }

    /** @return array<string, string|null> */
    private function config(): array
    {
        $mode = config('sslcommerz.mode') === 'live' ? 'live' : 'sandbox';
        $config = config("sslcommerz.$mode");

        if (blank($config['store_id']) || blank($config['store_password'])) {
            throw DomainException::unavailable(
                'SSLCOMMERZ credentials are not configured for the '.$mode.' environment.'
            );
        }

        return $config;
    }

    private function productSummary(Order $order): string
    {
        $names = $order->items->pluck('product_name')->unique()->take(3)->implode(', ');

        return mb_substr($names ?: 'Digital order', 0, 250);
    }
}
