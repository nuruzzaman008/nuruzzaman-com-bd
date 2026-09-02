<?php

namespace App\Policies;

use App\Models\Page;
use App\Models\User;

class PagePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('pages.view');
    }

    public function view(User $user, Page $page): bool
    {
        return $user->hasPermission('pages.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('pages.manage');
    }

    public function update(User $user, Page $page): bool
    {
        return $user->hasPermission('pages.manage');
    }

    public function publish(User $user, Page $page): bool
    {
        return $user->hasPermission('pages.publish');
    }

    public function delete(User $user, Page $page): bool
    {
        return $user->hasPermission('pages.manage');
    }
}
