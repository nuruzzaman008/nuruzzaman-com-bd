<?php

namespace App\Enums;

/**
 * Phase 1 activation is a manual vendor workflow. The website records only the
 * request, its review state and the safe customer-facing response. No signing
 * key, token or recovery material is ever stored here.
 */
enum ActivationRequestStatus: string
{
    case Submitted = 'submitted';
    case UnderReview = 'under_review';
    case NeedsInfo = 'needs_info';
    case Approved = 'approved';
    case Completed = 'completed';
    case Rejected = 'rejected';

    /** @return array<int, self> */
    public function next(): array
    {
        return match ($this) {
            self::Submitted => [self::UnderReview, self::NeedsInfo, self::Rejected],
            self::UnderReview => [self::NeedsInfo, self::Approved, self::Rejected],
            self::NeedsInfo => [self::UnderReview, self::Rejected],
            self::Approved => [self::Completed, self::Rejected],
            self::Completed, self::Rejected => [],
        };
    }

    public function allows(self $next): bool
    {
        return in_array($next, $this->next(), true);
    }

    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
