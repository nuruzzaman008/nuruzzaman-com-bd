<?php

namespace App\Support;

use App\Models\User;

/**
 * The blue badge beside a name, Facebook style: a verified email address and
 * a complete profile - every field of the profile form filled, and a photo.
 *
 * Worked out here, on the server, so the badge means the same everywhere and
 * cannot be switched on from the browser. It needs the profile relation
 * loaded; UserResource only asks when it is.
 */
final class ProfileBadge
{
    /** In the order the profile form shows them. */
    public const REQUIREMENTS = [
        'email_verified', 'photo', 'name', 'phone',
        'display_name', 'headline', 'organization', 'designation', 'district', 'bio',
    ];

    /** @return list<string> What is still missing; empty when the badge is earned. */
    public static function missing(User $user): array
    {
        $profile = $user->profile;
        $filled = fn (mixed $value): bool => is_string($value) ? trim($value) !== '' : filled($value);

        $met = [
            'email_verified' => $user->email_verified_at !== null,
            'photo' => $filled($profile?->avatar_path),
            'name' => $filled($user->name),
            'phone' => $filled($user->phone),
            'display_name' => $filled($profile?->display_name),
            'headline' => $filled($profile?->headline),
            'organization' => $filled($profile?->organization),
            'designation' => $filled($profile?->designation),
            'district' => $filled($profile?->district),
            'bio' => $filled($profile?->bio),
        ];

        return array_values(array_filter(self::REQUIREMENTS, fn (string $key) => ! $met[$key]));
    }

    public static function earned(User $user): bool
    {
        return self::missing($user) === [];
    }
}
