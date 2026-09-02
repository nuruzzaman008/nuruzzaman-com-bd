<?php

namespace App\Enums;

enum SupportTicketStatus: string
{
    case Open = 'open';
    case Pending = 'pending';
    case Resolved = 'resolved';
    case Closed = 'closed';

    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
