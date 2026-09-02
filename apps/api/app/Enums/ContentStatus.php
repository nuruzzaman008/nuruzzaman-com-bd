<?php

namespace App\Enums;

/**
 * Editorial workflow: draft to in_review to scheduled/published to archived.
 */
enum ContentStatus: string
{
    case Draft = 'draft';
    case InReview = 'in_review';
    case Scheduled = 'scheduled';
    case Published = 'published';
    case Archived = 'archived';

    /** Transitions allowed by the publishing service. */
    public function allows(self $next): bool
    {
        return in_array($next, match ($this) {
            self::Draft => [self::InReview, self::Scheduled, self::Published, self::Archived],
            self::InReview => [self::Draft, self::Scheduled, self::Published, self::Archived],
            self::Scheduled => [self::Draft, self::InReview, self::Published, self::Archived],
            self::Published => [self::Draft, self::Archived],
            self::Archived => [self::Draft],
        }, true);
    }

    public function isPubliclyVisible(): bool
    {
        return $this === self::Published;
    }

    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
