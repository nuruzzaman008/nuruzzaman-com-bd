<?php

namespace App\Enums;

enum LicenseStatus: string
{
    case Issued = 'issued';
    case Active = 'active';
    case Suspended = 'suspended';
    case Revoked = 'revoked';
    case Expired = 'expired';

    public function isUsable(): bool
    {
        return in_array($this, [self::Issued, self::Active], true);
    }

    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
