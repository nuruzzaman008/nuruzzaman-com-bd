<?php

namespace App\Policies;

use App\Enums\Role as RoleEnum;
use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('users.view');
    }

    public function view(User $user, User $target): bool
    {
        return $user->is($target) || $user->hasPermission('users.view');
    }

    public function update(User $user, User $target): bool
    {
        return $user->is($target) || $user->hasPermission('users.manage');
    }

    /** Only a super admin may change role assignments, and never their own. */
    public function assignRoles(User $user, User $target): bool
    {
        return $user->hasRole(RoleEnum::SuperAdmin) && ! $user->is($target);
    }

    public function delete(User $user, User $target): bool
    {
        return $user->hasRole(RoleEnum::SuperAdmin) && ! $user->is($target);
    }
}
