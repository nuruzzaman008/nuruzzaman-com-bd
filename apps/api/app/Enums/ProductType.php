<?php

namespace App\Enums;

enum ProductType: string
{
    /** NB Engineering Tools licence plus protected installer download. */
    case SoftwareLicense = 'software_license';
    /** NB Credit / token refill package. */
    case CreditRefill = 'credit_refill';
    /** A single LMS course. */
    case Course = 'course';
    /** Two or more of the above sold together. */
    case Bundle = 'bundle';
    /** Future downloadable engineering resource (template, checklist). */
    case DigitalResource = 'digital_resource';

    public function grantsDownload(): bool
    {
        return in_array($this, [self::SoftwareLicense, self::DigitalResource, self::Bundle], true);
    }

    public function grantsEnrollment(): bool
    {
        return in_array($this, [self::Course, self::Bundle], true);
    }

    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
