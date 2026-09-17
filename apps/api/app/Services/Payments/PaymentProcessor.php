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
use Illuminate\Support\Str;

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
    /** Statuses a signed callback may use to report that no money was taken. */
    private const FAILURE_STATUSES = ['FAILED', 'CANCELLED', 'CANCEL', 'UNATTEMPTED', 'EXPIRED'];

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
            // The column holds 48 characters; a longer status from a forged
            // callback must not turn the whole callback into a server error.
            'event_type' => mb_substr(strtolower((string) ($payload['status'] ?? 'unknown')), 0, 48),
            'fingerprint' => $fingerprint,
            'payload' => Audit::redact($payload),
            'remote_ip' => $remoteIp,
        ]);

        if (! $payment || $payment->gateway !== $this->gateway->name()) {
            return tap($event)->update([
                'is_valid' => false,
                'validation_error' => 'No payment matches this transaction reference.',
                'processed_at' => now(),
            ]);
        }

        $validation = $this->gateway->validateTransaction($payment, $payload);

        if ($validation->isValid) {
            $this->recordSuccess($payment, $event, $validation);

            return $event->refresh();
        }

        /*
          Failing a payment fails its order for good, so only the gateway may say
          so: either its validation API answered about this very transaction, or
          the callback carries the gateway's signature over its own reference and
          a failure status. Anyone who learns a reference can post a callback; a
          made-up val_id, none at all, or someone else's val_id used to fail an
          order while its customer was still paying. Such a callback is kept for
          the record and changes nothing.
        */
        $signedFailure = in_array(strtoupper((string) ($payload['status'] ?? '')), self::FAILURE_STATUSES, true)
            && $this->gateway->verifiesCallbackSignature($payload);

        if ($validation->authoritative || $signedFailure) {
            $this->recordFailure(
                $payment,
                $event,
                $validation,
                $validation->authoritative ? $validation->status : strtoupper((string) $payload['status']),
            );
        } else {
            $this->recordUnverified($payment, $event, $validation);
        }

        return $event->refresh();
    }

    private function recordFailure(Payment $payment, PaymentEvent $event, GatewayValidation $validation, string $gatewayStatus): void
    {
        DB::transaction(function () use ($payment, $event, $validation, $gatewayStatus) {
            $event->update([
                'is_valid' => false,
                'validation_error' => Str::limit((string) $validation->error, 250),
                'processed_at' => now(),
            ]);

            /** @var Payment $locked */
            $locked = Payment::query()->lockForUpdate()->findOrFail($payment->getKey());

            // A settled payment is never downgraded by a later failure callback;
            // out-of-order delivery must not undo a good settlement. A payment on
            // risk hold took money too and waits for a person, and a refunded one
            // is finished.
            if ($locked->status->isSettled() || in_array($locked->status, [PaymentStatus::RiskHold, PaymentStatus::Refunded], true)) {
                return;
            }

            $locked->update([
                'status' => in_array($gatewayStatus, ['CANCELLED', 'CANCEL'], true)
                    ? PaymentStatus::Cancelled
                    : PaymentStatus::Failed,
                'failed_at' => now(),
            ]);

            $order = $locked->order;

            if ($order && $order->status === OrderStatus::PendingPayment) {
                $this->states->transition($order, OrderStatus::Failed, Str::limit($validation->error ?? 'Payment failed', 250));
            }
        });

        Audit::record('payment.validation_failed', $payment, ['error' => $validation->error]);
    }

    /** Stored for the record; the payment and the order are left exactly as they were. */
    private function recordUnverified(Payment $payment, PaymentEvent $event, GatewayValidation $validation): void
    {
        $event->update([
            'is_valid' => false,
            'validation_error' => Str::limit('Not confirmed by the gateway, so nothing was changed. '.$validation->error, 250),
            'processed_at' => now(),
        ]);

        Audit::record('payment.callback_unverified', $payment, ['error' => $validation->error]);
    }

    private function recordSuccess(Payment $payment, PaymentEvent $event, GatewayValidation $validation): void
    {
        $holdForReview = $validation->isRisky()
            && config('nb.commerce.risk_order_policy') !== 'auto_release';

        $outcome = DB::transaction(function () use ($payment, $event, $validation, $holdForReview) {
            $event->update(['is_valid' => true, 'processed_at' => now()]);

            /** @var Payment $locked */
            $locked = Payment::query()->lockForUpdate()->findOrFail($payment->getKey());

            // Settled once is settled. The same transaction reported again - an
            // IPN retry that reads VALIDATED instead of VALID, or reconciliation
            // replaying it - has a new fingerprint, and used to overwrite the
            // settled record, refunded or not.
            if (in_array($locked->status, [PaymentStatus::Validated, PaymentStatus::Refunded], true)) {
                return ['recorded' => false, 'order' => null];
            }

            $payment = $locked;

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
                return ['recorded' => true, 'order' => null];
            }

            return ['recorded' => true, 'order' => $this->states->transition($order, OrderStatus::Paid, 'Payment validated by gateway')];
        });

        if (! $outcome['recorded']) {
            return;
        }

        Audit::record($holdForReview ? 'payment.risk_hold' : 'payment.validated', $payment, [
            'risk_level' => $validation->riskLevel,
            'amount_minor' => $validation->amountMinor,
        ]);

        // Dispatched only after the transaction above has committed.
        if ($outcome['order']) {
            FulfillOrder::dispatch($outcome['order']->getKey());
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
