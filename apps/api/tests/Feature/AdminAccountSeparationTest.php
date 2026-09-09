<?php

namespace Tests\Feature;

use App\Enums\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAccountSeparationTest extends TestCase
{
    use RefreshDatabase;

    public function test_administrators_cannot_use_customer_accounts_or_switch_mode(): void
    {
        foreach ([Role::Admin, Role::SuperAdmin] as $role) {
            $user = $this->userWithRole($role);
            $this->actingAs($user)->getJson('/api/v1/me')->assertOk();
            $this->getJson('/api/v1/account/orders')->assertForbidden();
            $this->getJson('/api/v1/account/courses')->assertForbidden();
            $this->patchJson('/api/v1/me', ['account_mode' => 'student'])->assertForbidden();
            $this->getJson('/api/v1/admin/courses')->assertOk();
        }
    }

    public function test_customer_can_still_use_account_and_switch_mode(): void
    {
        $this->actingAs($this->customer())->getJson('/api/v1/account/orders')->assertOk();
        $this->patchJson('/api/v1/me', ['account_mode' => 'student'])->assertOk()->assertJsonPath('data.account_mode', 'student');
    }
}
