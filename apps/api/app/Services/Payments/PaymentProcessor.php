<?php

namespace App\Services\Payments;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\DomainException;
use App\Jobs\FulfillOrder;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentEvent;
use App\Services\Commerce\OrderStateMachine;
use App\Support\Audit;
use App\Support\Reference;
use Illuminate\Support\Facades\DB;

/**
 * Owns the payment lifecycle.
 *
 * A customer landing on the success URL proves nothing. Only a callback that
 * survives server-side validation marks an order paid, every callback is stored
 * once by fingerprint, and fulfilment jobs are dispatched after the database
 * transaction commits.
 */
class PaymentProcessor
{
    public function __construct(
        private readonly PaymentGateway $gateway,
        private readonly OrderStateMachine $states,
    ) {}

    public function startPayment(Order $order): array
    {
        if ($order->status !== OrderStatus::PendingPayment) {
            throw DomainException::conflict('This order is not waiting for payment.');
        }

        $payment = DB::transaction(fn () => Payment::create([
            'order_id' => $order->getKey(),
            'gateway' => $this->gateway->name(),
            'reference' => Reference::payment(),
            'status' => PaymentStatus::Initiated,
            'currency' => $order->currency,
            'amount_minor' => $order->total_minor,
        ]));

        $session = $this->gateway->createSession($order->load('items'), $payment);

        $payment->update([
            'gateway_session_key' => $session->sessionKey,
            'status' => PaymentStatus::Pending,
        ]);

        Audit::record('payment.session_created', $payment, [
            'order' => $order->number,
            'amount_minor' => $payment->amount_minor,
        ]);

        return ['payment' => $payment, 'redirect_url' => $session->redirectUrl];
    }

    /**
     * Processes an IPN or a return-url confirmation. Safe to call any number of
     * times, in any order, with duplicated or out-of-order callbacks.
     */
    public function handleCallback(string $source, array $payload, ?string $remoteIp = null): PaymentEvent
    {
        $reference = $payload['tran_id'] ?? null;
        $fingerprint = $this->fingerprint($source, $payload);

        $existing = PaymentEvent::query()->where('fingerprint', $fingerprint)->first();

        if ($existing) {
            return $existing;
        }

        /** @var Payment|null $payment */
        $payment = $reference ? Payment::query()->where('reference', $reference)->first() : null;

        $event = PaymentEvent::create([
            'payment_id' => $payment?->getKey(),
            'source' => $source,
            'event_type' => strtolower((string) ($payload['status'] ?? 'unknown')),
            'fingerprint' => $fingerprint,
            'payload' => Audit::redact($payload),
            'remote_ip' => $remoteIp,
        ]);

        if (! $payment) {
            return tap($event)->update([
                'is_valid' => false,
                'validation_error' => 'No payment matches this transaction reference.',
                'processed_at' => now(),
            ]);
        }

        $validation = $this->gateway->validateTransaction($payment, $payload);

        if (! $validation->isValid) {
            $this->recordFailure($payment, $event, $validation);

            return $event->refresh();
        }

        $this->recordSuccess($payment, $event, $validation);

        return $event->refresh();
    }

    private function recordFailure(Payment $payment, PaymentEvent $event, GatewayValidation $validation): void
    {
        DB::transaction(function () use ($payment, $event, $validation) {
            $event->update([
                'is_valid' => false,
                'validation_error' => $validation->error,
                'processed_at' => now(),
            ]);

            // An already-settled payment is never downgraded by a later failure
            // callback; out-of-order delivery must not undo a good settlement.
            if ($payment->status->isSettled()) {
                return;
            }

            $payment->update([
                'status' => in_array(strtoupper($validation->status), ['CANCELLED', 'CANCEL'], true)
                    ? PaymentStatus::Cancelled
                    : PaymentStatus::Failed,
                'failed_at' => now(),
            ]);

            $order = $payment->order;

            if ($order && $order->status === OrderStatus::PendingPayment) {
                $this->states->transition($order, OrderStatus::Failed, $validation->error ?? 'Payment failed');
            }
        });

        Audit::record('payment.validation_failed', $payment, ['error' => $validation->error]);
    }

    private function recordSuccess(Payment $payment, PaymentEvent $event, GatewayValidation $validation): void
    {
        $holdForReview = $validation->isRisky()
            && config('nb.commerce.risk_order_policy') !== 'auto_release';

        $order = DB::transaction(function () use ($payment, $event, $validation, $holdForReview) {
            $event->update(['is_valid' => true, 'processed_at' => now()]);

            $payment->update([
                'status' => $holdForReview ? PaymentStatus::RiskHold : PaymentStatus::Validated,
                'gateway_transaction_id' => $validation->transactionId,
                'bank_transaction_id' => $validation->bankTransactionId,
                'card_type' => $validation->cardType,
                'settled_amount_minor' => $validation->amountMinor,
                'risk_level' => $validation->riskLevel,
                'risk_title' => $validation->riskTitle,
                'validated_at' => now(),
            ]);

            $order = $payment->order()->firstOrFail();

            if ($holdForReview || ! $order->status->allows(OrderStatus::Paid)) {
                return null;
            }

            return $this->states->transition($order, OrderStatus::Paid, 'Payment validated by gateway');
        });

        Audit::record($holdForReview ? 'payment.risk_hold' : 'payment.validated', $payment, [
            'risk_level' => $validation->riskLevel,
            'amount_minor' => $validation->amountMinor,
        ]);

        // Dispatched only after the transaction above has committed.
        if ($order) {
            FulfillOrder::dispatch($order->getKey());
        }
    }

    private function fingerprint(string $source, array $payload): string
    {
        return hash('sha256', implode('|', [
            $source,
            $payload['tran_id'] ?? '',
            $payload['val_id'] ?? '',
            strtoupper((string) ($payload['status'] ?? '')),
            $payload['bank_tran_id'] ?? '',
        ]));
    }
}
