<?php

namespace Tests;

use App\Enums\Role as RoleEnum;
use App\Models\Role;
use App\Models\User;
use App\Support\Totp;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Sanctum only treats a request as first-party when its Origin/Referer
        // host is a stateful domain. Tests exercise the same cookie-session
        // path the Next.js frontend uses, so the header has to be present.
        $this->withHeader('Origin', 'http://localhost');

        // The frontend sends `credentials: include`; JSON test requests only
        // carry cookies when the harness is told to do the same.
        $this->withCredentials();
    }

    /** Seeds the fixed role and permission vocabulary once per test. */
    protected function seedRoles(): void
    {
        $this->seed(RoleSeeder::class);
    }

    /**
     * Staff are created with two-step verification already set up, because the
     * dashboard refuses staff without it (RequireStaffMfa) and every admin test
     * would otherwise be testing that refusal. Pass a null mfa_confirmed_at for
     * an account that has not set it up.
     */
    protected function userWithRole(RoleEnum $role, array $attributes = []): User
    {
        $this->seedRolesIfMissing();

        if ($role !== RoleEnum::Customer) {
            $attributes += [
                'mfa_secret' => Totp::generateSecret(),
                'mfa_confirmed_at' => now(),
            ];
        }

        $user = User::factory()->create($attributes);
        $user->roles()->attach(Role::query()->where('name', $role->value)->firstOrFail());

        return $user->fresh();
    }

    protected function customer(array $attributes = []): User
    {
        return $this->userWithRole(RoleEnum::Customer, $attributes);
    }

    private function seedRolesIfMissing(): void
    {
        if (Role::query()->count() === 0) {
            $this->seedRoles();
        }
    }
}
