<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\User;
use App\Support\Totp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * Two-step verification: required for staff, optional for customers, and the
 * only way past a correct password once it is on. Hardening pass of
 * 21 September 2026.
 */
class TwoFactorTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-42';

    /** Sets up an authenticator for a user the way the dashboard does. */
    private function enrol(User $user): string
    {
        $secret = $this->actingAs($user)
            ->postJson('/api/v1/me/mfa')
            ->assertOk()
            ->json('data.secret');

        $this->actingAs($user)
            ->postJson('/api/v1/me/mfa/confirm', ['code' => Totp::at($secret, intdiv(time(), 30))])
            ->assertOk()
            ->assertJsonPath('data.mfa_enabled', true);

        return $secret;
    }

    public function test_staff_cannot_use_the_dashboard_until_the_second_step_is_set_up(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin, ['mfa_secret' => null, 'mfa_confirmed_at' => null]);

        $this->actingAs($admin)->getJson('/api/v1/admin/orders')->assertStatus(403);
        // Their own account still works, so they can set it up.
        $this->actingAs($admin)->getJson('/api/v1/me')->assertOk();

        $this->enrol($admin);

        $this->actingAs($admin->fresh())->getJson('/api/v1/admin/orders')->assertOk();
    }

    public function test_a_customer_is_not_forced_to_use_it(): void
    {
        $customer = $this->customer();

        $this->actingAs($customer)->getJson('/api/v1/me')->assertOk();
        $this->actingAs($customer)->getJson('/api/v1/account/orders')->assertOk();

        // But may turn it on.
        $this->enrol($customer);
        $this->assertTrue($customer->fresh()->hasTwoFactor());
    }

    public function test_setup_needs_the_right_code(): void
    {
        $user = $this->customer();

        $secret = $this->actingAs($user)->postJson('/api/v1/me/mfa')->assertOk()->json('data.secret');
        $this->assertSame(32, strlen($secret));

        $this->actingAs($user)
            ->postJson('/api/v1/me/mfa/confirm', ['code' => '000000'])
            ->assertStatus(422);

        $this->assertFalse($user->fresh()->hasTwoFactor());
        // An unconfirmed secret does not count, so the dashboard still asks.
        $this->assertNotNull($user->fresh()->mfa_secret);
    }

    public function test_the_password_alone_no_longer_signs_a_protected_account_in(): void
    {
        $user = $this->customer(['password' => self::PASSWORD]);
        $secret = $this->enrol($user);

        // A fresh browser: password first.
        $this->flushSession();
        $this->post('/api/v1/auth/logout');

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD])
            ->assertOk()
            ->assertJsonPath('data.mfa_required', true);

        // Not signed in yet.
        $this->getJson('/api/v1/me')->assertStatus(401);

        $this->postJson('/api/v1/auth/mfa', ['code' => '000000'])->assertStatus(422);
        $this->getJson('/api/v1/me')->assertStatus(401);

        $this->postJson('/api/v1/auth/mfa', ['code' => Totp::at($secret, intdiv(time(), 30))])
            ->assertOk()
            ->assertJsonPath('data.email', $user->email);

        $this->getJson('/api/v1/me')->assertOk();
    }

    public function test_a_code_without_a_password_first_is_refused(): void
    {
        $user = $this->customer(['password' => self::PASSWORD]);
        $secret = $this->enrol($user);

        $this->flushSession();

        $this->postJson('/api/v1/auth/mfa', ['code' => Totp::at($secret, intdiv(time(), 30))])
            ->assertStatus(422);

        $this->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_wrong_codes_lock_the_challenge(): void
    {
        $user = $this->customer(['password' => self::PASSWORD]);
        $secret = $this->enrol($user);
        $this->flushSession();

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD])->assertOk();

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->postJson('/api/v1/auth/mfa', ['code' => '000000'])->assertStatus(422);
        }

        // Locked: even the right code would now be refused, and the account is
        // still not signed in.
        $this->assertTrue(RateLimiter::tooManyAttempts('mfa:'.$user->getKey(), 3));
        $this->getJson('/api/v1/me')->assertStatus(401);
        $this->assertNotNull($secret);
    }

    public function test_turning_it_off_needs_the_password(): void
    {
        $user = $this->customer(['password' => self::PASSWORD]);
        $this->enrol($user);

        $this->actingAs($user->fresh())
            ->deleteJson('/api/v1/me/mfa', ['password' => 'not-the-password'])
            ->assertStatus(422);

        $this->assertTrue($user->fresh()->hasTwoFactor());

        $this->actingAs($user->fresh())
            ->deleteJson('/api/v1/me/mfa', ['password' => self::PASSWORD])
            ->assertOk();

        $this->assertFalse($user->fresh()->hasTwoFactor());
    }

    public function test_the_owner_can_clear_it_from_the_server_when_a_phone_is_lost(): void
    {
        $user = $this->customer();
        $this->enrol($user);

        $this->artisan('nb:mfa-reset', ['email' => $user->email])->assertSuccessful();

        $this->assertFalse($user->fresh()->hasTwoFactor());
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.mfa_reset_by_owner']);
    }

    public function test_the_secret_is_never_stored_or_returned_in_the_clear(): void
    {
        $user = $this->customer();
        $secret = $this->enrol($user);

        $stored = (string) User::query()->whereKey($user->getKey())->value('mfa_secret');
        $this->assertNotSame($secret, $stored);
        $this->assertStringNotContainsString($secret, $this->actingAs($user->fresh())->getJson('/api/v1/me')->getContent());
    }
}
