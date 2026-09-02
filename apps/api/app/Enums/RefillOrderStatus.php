<?php

namespace App\Enums;

enum RefillOrderStatus: string
{
    case Requested = 'requested';
    case Approved = 'approved';
    case Issued = 'issued';
    case Rejected = 'rejected';

    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
