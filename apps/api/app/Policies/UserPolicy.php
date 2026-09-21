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

    /**
     * Clearing another staff member's two-step verification, for when they have
     * lost the phone and the recovery codes.
     *
     * Super admins and admins only, never on their own account (that is what
     * their own Security page is for), and only for staff: customers are not
     * made to use it in the first place. A super admin is, as above, out of
     * reach of anyone who is not one - otherwise an administrator could strip
     * the owner's second step.
     */
    public function resetTwoFactor(User $user, User $target): bool
    {
        if ($user->is($target) || ! $target->isStaff()) {
            return false;
        }

        if (! $user->hasRole(RoleEnum::SuperAdmin) && ! $user->hasRole(RoleEnum::Admin)) {
            return false;
        }

        if ($target->hasRole(RoleEnum::SuperAdmin)) {
            return $user->hasRole(RoleEnum::SuperAdmin);
        }

        return true;
    }

    public function delete(User $user, User $target): bool
    {
        return $user->hasRole(RoleEnum::SuperAdmin) && ! $user->is($target);
    }
}
