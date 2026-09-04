<?php

namespace App\Enums;

/**
 * Where a reader's comment stands.
 *
 * `Pending` is the default, and only `Approved` is ever public. There is no
 * "publish immediately" path: an unmoderated comment box on a site that gives
 * engineering advice is a place for spam links to land, and once one is indexed
 * it is the site's problem rather than the spammer's.
 */
enum CommentStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Spam = 'spam';

    /** The states a moderator can move a comment into. */
    public static function moderatable(): array
    {
        return [self::Approved->value, self::Rejected->value, self::Spam->value];
    }
}
