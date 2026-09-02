<?php

namespace App\Enums;

enum EnrollmentStatus: string
{
    case Active = 'active';
    case Completed = 'completed';
    case Expired = 'expired';
    case Revoked = 'revoked';

    public function grantsAccess(): bool
    {
        return in_array($this, [self::Active, self::Completed], true);
    }

    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
