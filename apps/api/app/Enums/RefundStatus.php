<?php

namespace App\Enums;

enum RefundStatus: string
{
    case Requested = 'requested';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Processed = 'processed';

    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
