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
        if ($user->is($target)) {
            return true;
        }

        if (! $user->hasPermission('users.manage')) {
            return false;
        }

        /*
          A super admin is out of reach of anyone who is not one.

          The admin role carries every permission, users.manage included, so
          without this an administrator could suspend the owner's account -
          locking them out of their own site entirely, since EnsureUserIsActive
          then refuses every request. Changing their role was already
          impossible; this closes the other way round to the same result.
        */
        if ($target->hasRole(RoleEnum::SuperAdmin)) {
            return $user->hasRole(RoleEnum::SuperAdmin);
        }

        return true;
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
