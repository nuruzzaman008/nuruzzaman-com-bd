<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\User;
use App\Support\MfaSession;
use App\Support\Totp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Testing\TestResponse;
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

    /**
     * An account that already has an authenticator, set up without signing in:
     * actingAs() would leave the test authenticated, and these tests are about
     * what a password alone can do from a cold start.
     */
    private function alreadyProtected(User $user): string
    {
        $secret = Totp::generateSecret();
        $user->forceFill(['mfa_secret' => $secret, 'mfa_confirmed_at' => now()])->save();

        return $secret;
    }

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
        $secret = $this->alreadyProtected($user);

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
        $secret = $this->alreadyProtected($user);

        $this->postJson('/api/v1/auth/mfa', ['code' => Totp::at($secret, intdiv(time(), 30))])
            ->assertStatus(422);

        $this->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_a_code_sent_from_outside_the_website_is_refused(): void
    {
        $user = $this->customer(['password' => self::PASSWORD]);
        $secret = $this->alreadyProtected($user);

        // No Origin, so Sanctum starts no session: there is no half-finished
        // sign-in to complete, and the answer is a refusal rather than a 500.
        $this->withoutHeader('Origin')
            ->postJson('/api/v1/auth/mfa', ['code' => Totp::at($secret, intdiv(time(), 30))])
            ->assertStatus(422);
    }

    public function test_wrong_codes_lock_the_challenge(): void
    {
        $user = $this->customer(['password' => self::PASSWORD]);
        $secret = $this->alreadyProtected($user);

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD])
            ->assertOk()
            ->assertJsonPath('data.mfa_required', true);

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->postJson('/api/v1/auth/mfa', ['code' => '000000'])->assertStatus(422);
        }

        // Locked: even the right code would now be refused, and the account is
        // still not signed in.
        $this->assertTrue(RateLimiter::tooManyAttempts('mfa:'.$user->getKey(), 3));
        $this->getJson('/api/v1/me')->assertStatus(401);
        $this->assertNotNull($secret);
    }

    /**
     * A staff session that got in without typing a code - Google, a
     * remember-me cookie - is signed in, but the dashboard stays shut until it
     * does. be() rather than actingAs(): this session has not seen a code.
     */
    public function test_a_staff_session_that_never_typed_the_code_is_asked_for_it(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $secret = (string) $admin->mfa_secret;

        $this->be($admin)->getJson('/api/v1/admin/orders')->assertStatus(403);
        $this->be($admin)->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('data.mfa_enabled', true)
            ->assertJsonPath('data.mfa_session_verified', false);

        $this->be($admin)->postJson('/api/v1/me/mfa/verify', ['code' => '000000'])->assertStatus(422);
        $this->be($admin)->getJson('/api/v1/admin/orders')->assertStatus(403);

        $this->be($admin)
            ->postJson('/api/v1/me/mfa/verify', ['code' => Totp::at($secret, intdiv(time(), 30))])
            ->assertOk()
            ->assertJsonPath('data.mfa_session_verified', true);

        $this->be($admin)->getJson('/api/v1/admin/orders')->assertOk();
        $this->be($admin)->getJson('/api/v1/me')->assertJsonPath('data.mfa_session_verified', true);
    }

    public function test_asking_again_locks_after_three_wrong_codes(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $secret = (string) $admin->mfa_secret;

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->be($admin)->postJson('/api/v1/me/mfa/verify', ['code' => '000000'])->assertStatus(422);
        }

        // Locked: the right code is refused too, and the dashboard stays shut.
        $this->be($admin)
            ->postJson('/api/v1/me/mfa/verify', ['code' => Totp::at($secret, intdiv(time(), 30))])
            ->assertStatus(422);
        $this->be($admin)->getJson('/api/v1/admin/orders')->assertStatus(403);
    }

    /** A code seen by one account's session does not open another's. */
    public function test_the_proof_belongs_to_one_account(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $other = $this->userWithRole(RoleEnum::Admin);

        $this->withSession([MfaSession::VERIFIED => $other->getKey()]);

        $this->be($admin)->getJson('/api/v1/admin/orders')->assertStatus(403);
    }

    private function fakeGoogle(User $user): void
    {
        config([
            'services.google.client_id' => 'test-client',
            'services.google.client_secret' => 'test-secret',
        ]);

        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'test-access-token']),
            'www.googleapis.com/oauth2/v3/userinfo' => Http::response([
                'sub' => 'google-'.$user->getKey(),
                'email' => $user->email,
                'email_verified' => true,
                'name' => $user->name,
            ]),
        ]);
    }

    private function googleCallback(): TestResponse
    {
        return $this->withSession(['google_oauth_state' => 'test-state'])
            ->get('/api/v1/auth/google/callback?state=test-state&code=test-code');
    }

    /** Google proves who holds the Google account, not the authenticator. */
    public function test_google_does_not_skip_the_code(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $secret = (string) $admin->mfa_secret;
        $this->fakeGoogle($admin);

        $this->googleCallback()->assertRedirectContains('/login?mfa=1');

        // Not signed in yet.
        $this->getJson('/api/v1/me')->assertStatus(401);

        $this->postJson('/api/v1/auth/mfa', ['code' => '000000'])->assertStatus(422);
        $this->getJson('/api/v1/me')->assertStatus(401);

        $this->postJson('/api/v1/auth/mfa', ['code' => Totp::at($secret, intdiv(time(), 30))])
            ->assertOk()
            ->assertJsonPath('data.email', $admin->email);

        $this->getJson('/api/v1/admin/orders')->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.mfa_challenged']);
    }

    /** No long-lived cookie for staff: it would outlast a password change. */
    public function test_staff_signed_in_through_google_are_not_remembered(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin, ['mfa_secret' => null, 'mfa_confirmed_at' => null]);
        $this->fakeGoogle($admin);

        $this->googleCallback()
            ->assertRedirectContains('/dashboard')
            ->assertCookieMissing(Auth::guard('web')->getRecallerName());

        // Signed in, but the dashboard still wants the second step set up.
        $this->getJson('/api/v1/me')->assertOk();
        $this->getJson('/api/v1/admin/orders')->assertStatus(403);
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

        $stored = (string) DB::table('users')->where('id', $user->getKey())->value('mfa_secret');
        $this->assertNotSame($secret, $stored);
        $this->assertStringNotContainsString($secret, $this->actingAs($user->fresh())->getJson('/api/v1/me')->getContent());
    }
}
