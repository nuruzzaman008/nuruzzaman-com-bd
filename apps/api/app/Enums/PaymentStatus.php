<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Initiated = 'initiated';
    case Pending = 'pending';
    case Validated = 'validated';
    case RiskHold = 'risk_hold';
    case Failed = 'failed';
    case Cancelled = 'cancelled';
    case Refunded = 'refunded';

    public function isSettled(): bool
    {
        return $this === self::Validated;
    }

    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
