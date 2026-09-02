<?php

namespace Tests;

use App\Enums\Role as RoleEnum;
use App\Models\Role;
use App\Models\User;
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

    protected function userWithRole(RoleEnum $role, array $attributes = []): User
    {
        $this->seedRolesIfMissing();

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
