<?php

namespace App\Services\Notifications;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Profile photo addresses for the people in a list, looked up in one query.
 *
 * Photos are private files served by /admin/users/{id}/avatar, which asks for
 * the users.view permission (UserPolicy::view); a viewer without it gets no
 * addresses, and the dashboard draws initials instead of broken images.
 */
final class AvatarUrls
{
    /** @var array<int, bool> */
    private array $has = [];

    private readonly bool $allowed;

    public function __construct(User $viewer)
    {
        $this->allowed = $viewer->hasPermission('users.view');
    }

    /** @param  list<int|string|null>  $userIds */
    public function load(array $userIds): void
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $userIds))));
        if (! $this->allowed || $ids === []) {
            return;
        }

        $with = DB::table('profiles')
            ->whereIn('user_id', $ids)
            ->whereNotNull('avatar_path')
            ->where('avatar_path', '!=', '')
            ->pluck('user_id');

        foreach ($with as $id) {
            $this->has[(int) $id] = true;
        }
    }

    public function for(int|string|null $userId): ?string
    {
        $id = (int) $userId;

        return $this->allowed && $id > 0 && ($this->has[$id] ?? false)
            ? '/api/v1/admin/users/'.$id.'/avatar'
            : null;
    }
}
