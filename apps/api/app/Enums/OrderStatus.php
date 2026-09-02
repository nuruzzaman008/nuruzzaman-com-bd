<?php

namespace App\Enums;

/**
 * Order lifecycle:
 *
 *   draft -> pending_payment -> paid -> fulfilled
 *                            -> failed
 *                            -> cancelled
 *   paid|fulfilled -> refund_pending -> refunded | partially_refunded
 *
 * Transitions are only applied through App\Services\Commerce\OrderStateMachine,
 * never by assigning the column directly from a controller.
 */
enum OrderStatus: string
{
    case Draft = 'draft';
    case PendingPayment = 'pending_payment';
    case Paid = 'paid';
    case Fulfilled = 'fulfilled';
    case Failed = 'failed';
    case Cancelled = 'cancelled';
    case RefundPending = 'refund_pending';
    case PartiallyRefunded = 'partially_refunded';
    case Refunded = 'refunded';

    /** @return array<int, self> */
    public function next(): array
    {
        return match ($this) {
            self::Draft => [self::PendingPayment, self::Cancelled],
            self::PendingPayment => [self::Paid, self::Failed, self::Cancelled],
            self::Paid => [self::Fulfilled, self::RefundPending],
            self::Fulfilled => [self::RefundPending],
            self::RefundPending => [self::Refunded, self::PartiallyRefunded, self::Paid, self::Fulfilled],
            self::PartiallyRefunded => [self::Refunded, self::RefundPending],
            self::Failed, self::Cancelled, self::Refunded => [],
        };
    }

    public function allows(self $next): bool
    {
        return in_array($next, $this->next(), true);
    }

    /** Entitlements (downloads, enrolments) are live in these states. */
    public function grantsEntitlements(): bool
    {
        return in_array($this, [self::Paid, self::Fulfilled, self::RefundPending, self::PartiallyRefunded], true);
    }

    public function isTerminal(): bool
    {
        return $this->next() === [];
    }

    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
