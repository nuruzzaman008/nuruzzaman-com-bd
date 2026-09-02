<?php

namespace App\Services\Payments;

use App\Models\Order;
use App\Models\Payment;

/**
 * The contract the checkout flow depends on. SslCommerzGateway talks to the
 * real API; FakeGateway keeps the whole flow testable without credentials.
 */
interface PaymentGateway
{
    public function name(): string;

    /** Creates a hosted payment session and returns where to send the customer. */
    public function createSession(Order $order, Payment $payment): GatewaySession;

    /**
     * Verifies a transaction with the gateway's own API. Callers must treat
     * anything other than a valid result as "not paid".
     */
    public function validateTransaction(Payment $payment, array $callback): GatewayValidation;

    public function refund(Payment $payment, int $amountMinor, string $reason): GatewayRefund;
}
