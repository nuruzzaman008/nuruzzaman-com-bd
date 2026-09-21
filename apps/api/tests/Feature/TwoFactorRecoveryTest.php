<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\User;
use App\Support\Totp;
use App\Support\TwoFactor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Google Authenticator setup with a QR code, recovery codes, and each code
 * working only once. Complements TwoFactorTest, which covers the sign-in gate
 * itself.
 */
class TwoFactorRecoveryTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-42';

    /**
     * The per-address throttle in front of the sign-in routes (five a minute)
     * is not what these tests are about, and several sign in twice. The lock
     * they do test - three wrong codes per account - is in the controllers and
     * stays on.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ThrottleRequests::class);
    }

    /** An account with an authenticator and a set of recovery codes. */
    private function protectedAccount(RoleEnum $role = RoleEnum::Customer): array
    {
        $user = $role === RoleEnum::Customer
            ? $this->customer(['password' => self::PASSWORD])
            : $this->userWithRole($role, ['password' => self::PASSWORD]);
        $secret = Totp::generateSecret();
        $user->forceFill(['mfa_secret' => $secret, 'mfa_confirmed_at' => now()])->save();
        $codes = TwoFactor::generateRecoveryCodes($user);

        return [$user->fresh(), $secret, $codes];
    }

    private function passwordStep(User $user): void
    {
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD])
            ->assertOk()
            ->assertJsonPath('data.mfa_required', true);
    }

    /** As if the browser had closed: no signed-in user, an empty session. */
    private function coldStart(): void
    {
        $this->app['auth']->forgetGuards();
        $this->flushSession();
    }

    public function test_setup_hands_out_a_qr_address_for_this_app_and_this_account(): void
    {
        $user = $this->customer();

        $response = $this->actingAs($user)->postJson('/api/v1/me/mfa')->assertOk();

        $secret = $response->json('data.secret');
        $uri = $response->json('data.otpauth_uri');

        $this->assertSame(32, strlen($secret));
        $this->assertStringStartsWith('otpauth://totp/nuruzzaman.com.bd:'.rawurlencode($user->email).'?', $uri);
        $this->assertStringContainsString('secret='.$secret, $uri);
        $this->assertStringContainsString('issuer=nuruzzaman.com.bd', $uri);
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));

        // Restarting throws the first secret away.
        $again = $this->actingAs($user)->postJson('/api/v1/me/mfa')->assertOk()->json('data.secret');
        $this->assertNotSame($secret, $again);
    }

    public function test_a_wrong_code_does_not_turn_it_on_and_the_right_one_hands_out_recovery_codes(): void
    {
        $user = $this->customer();
        $secret = $this->actingAs($user)->postJson('/api/v1/me/mfa')->json('data.secret');

        $this->actingAs($user)->postJson('/api/v1/me/mfa/confirm', ['code' => '000000'])->assertStatus(422);
        $this->actingAs($user)->postJson('/api/v1/me/mfa/confirm', ['code' => 'abcdef'])->assertStatus(422);
        $this->assertFalse($user->fresh()->hasTwoFactor());

        $response = $this->actingAs($user)
            ->postJson('/api/v1/me/mfa/confirm', ['code' => Totp::at($secret, Totp::currentStep())])
            ->assertOk()
            ->assertJsonPath('data.mfa_enabled', true);

        $codes = $response->json('data.recovery_codes');
        $this->assertCount(8, $codes);
        $this->assertCount(8, array_unique($codes));
        foreach ($codes as $code) {
            $this->assertMatchesRegularExpression('/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/', $code);
        }
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $this->assertTrue($user->fresh()->hasTwoFactor());

        // Kept as hashes: the database never holds a usable code.
        $stored = (string) DB::table('users')->where('id', $user->getKey())->value('mfa_recovery_codes');
        foreach ($codes as $code) {
            $this->assertStringNotContainsString($code, $stored);
            $this->assertStringNotContainsString(str_replace('-', '', $code), $stored);
        }
    }

    public function test_setup_attempts_are_limited(): void
    {
        $user = $this->customer();
        $secret = $this->actingAs($user)->postJson('/api/v1/me/mfa')->json('data.secret');

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->actingAs($user)->postJson('/api/v1/me/mfa/confirm', ['code' => '000000'])->assertStatus(422);
        }

        // Locked: even the right code is refused for now.
        $this->actingAs($user)
            ->postJson('/api/v1/me/mfa/confirm', ['code' => Totp::at($secret, Totp::currentStep())])
            ->assertStatus(422);
        $this->assertFalse($user->fresh()->hasTwoFactor());
    }

    public function test_once_it_is_on_the_secret_is_never_handed_out_again(): void
    {
        [$user, $secret] = $this->protectedAccount();

        $this->actingAs($user)->postJson('/api/v1/me/mfa')->assertStatus(422);
        $this->assertSame($secret, $user->fresh()->mfa_secret);

        $me = $this->actingAs($user)->getJson('/api/v1/me')->assertOk();
        $this->assertStringNotContainsString($secret, $me->getContent());
        $me->assertJsonPath('data.mfa_enabled', true)
            ->assertJsonPath('data.mfa_recovery_codes_remaining', 8)
            ->assertJsonMissingPath('data.mfa_secret')
            ->assertJsonMissingPath('data.mfa_recovery_codes');
    }

    public function test_another_account_never_sees_this_ones_secret_or_codes(): void
    {
        [$user, $secret] = $this->protectedAccount(RoleEnum::Admin);
        $owner = $this->userWithRole(RoleEnum::SuperAdmin);

        $record = $this->actingAs($owner)->getJson('/api/v1/admin/users/'.$user->getKey())->assertOk();
        $list = $this->actingAs($owner)->getJson('/api/v1/admin/users')->assertOk();

        foreach ([$record, $list] as $response) {
            $this->assertStringNotContainsString($secret, $response->getContent());
            $this->assertStringNotContainsString('"mfa_recovery_codes":', $response->getContent());
            $this->assertStringNotContainsString('"mfa_last_used_step":', $response->getContent());
            $this->assertStringNotContainsString('"mfa_secret":', $response->getContent());
        }

        // And the owner's own setup endpoints act on the owner only.
        $this->actingAs($owner)->postJson('/api/v1/me/mfa/confirm', ['code' => Totp::at($secret, Totp::currentStep())])
            ->assertStatus(422);
        $this->assertSame($secret, $user->fresh()->mfa_secret);
    }

    public function test_the_same_app_code_is_not_accepted_twice(): void
    {
        [$user, $secret] = $this->protectedAccount();
        $code = Totp::at($secret, Totp::currentStep());

        $this->passwordStep($user);
        $this->postJson('/api/v1/auth/mfa', ['code' => $code])->assertOk();

        $this->coldStart();

        // Someone who saw that code, with the password, a minute later.
        $this->passwordStep($user);
        $this->postJson('/api/v1/auth/mfa', ['code' => $code])->assertStatus(422);
        $this->getJson('/api/v1/me')->assertStatus(401);

        // The next code from the app is fine.
        $this->postJson('/api/v1/auth/mfa', ['code' => Totp::at($secret, Totp::currentStep() + 1)])->assertOk();
    }

    public function test_a_recovery_code_signs_in_once_when_the_phone_is_not_to_hand(): void
    {
        [$user, , $codes] = $this->protectedAccount(RoleEnum::Admin);

        $this->passwordStep($user);
        $this->postJson('/api/v1/auth/mfa', ['recovery_code' => $codes[0]])
            ->assertOk()
            ->assertJsonPath('data.email', $user->email);

        // A recovery code is a full second step: the dashboard opens.
        $this->getJson('/api/v1/admin/orders')->assertOk();
        $this->getJson('/api/v1/me')->assertJsonPath('data.mfa_recovery_codes_remaining', 7);
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.mfa_recovery_code_used']);

        $this->coldStart();

        $this->passwordStep($user);
        $this->postJson('/api/v1/auth/mfa', ['recovery_code' => $codes[0]])->assertStatus(422);
        $this->getJson('/api/v1/me')->assertStatus(401);

        // Typed from a printout, in lower case and without the dashes.
        $this->postJson('/api/v1/auth/mfa', ['recovery_code' => strtolower(str_replace('-', ' ', $codes[1]))])
            ->assertOk();
    }

    public function test_made_up_recovery_codes_count_towards_the_lock(): void
    {
        [$user, , $codes] = $this->protectedAccount();

        $this->passwordStep($user);

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->postJson('/api/v1/auth/mfa', ['recovery_code' => 'AAAA-BBBB-CCCC-DDDD'])->assertStatus(422);
        }

        $this->postJson('/api/v1/auth/mfa', ['recovery_code' => $codes[0]])->assertStatus(422);
        $this->getJson('/api/v1/me')->assertStatus(401);
        // The real code was not spent by the refused attempt.
        $this->assertSame(8, TwoFactor::remainingRecoveryCodes($user->fresh()));
    }

    public function test_the_code_step_needs_one_of_the_two(): void
    {
        [$user] = $this->protectedAccount();

        $this->passwordStep($user);
        $this->postJson('/api/v1/auth/mfa', [])->assertStatus(422)
            ->assertJsonValidationErrors(['code', 'recovery_code'], 'error.fields');
    }

    public function test_a_recovery_code_also_answers_the_dashboard_s_request_for_a_code(): void
    {
        [$admin, , $codes] = $this->protectedAccount(RoleEnum::Admin);

        // Signed in without typing a code (a remember-me cookie, say).
        $this->be($admin)->getJson('/api/v1/admin/orders')->assertStatus(403);

        $this->be($admin)->postJson('/api/v1/me/mfa/verify', ['recovery_code' => $codes[2]])->assertOk();
        $this->be($admin)->getJson('/api/v1/admin/orders')->assertOk();
        $this->assertSame(7, TwoFactor::remainingRecoveryCodes($admin->fresh()));
    }

    public function test_new_recovery_codes_need_the_password_and_a_session_that_typed_a_code(): void
    {
        [$user, , $old] = $this->protectedAccount();

        // Signed in, but this session never typed a code.
        $this->be($user)->postJson('/api/v1/me/mfa/recovery-codes', ['password' => self::PASSWORD])->assertStatus(403);

        $this->actingAs($user)->postJson('/api/v1/me/mfa/recovery-codes', ['password' => 'wrong-password'])
            ->assertStatus(422);

        $new = $this->actingAs($user)
            ->postJson('/api/v1/me/mfa/recovery-codes', ['password' => self::PASSWORD])
            ->assertOk()
            ->json('data.recovery_codes');

        $this->assertCount(8, $new);
        $this->assertEmpty(array_intersect($old, $new));

        // The old set stopped working.
        $this->coldStart();
        $this->passwordStep($user);
        $this->postJson('/api/v1/auth/mfa', ['recovery_code' => $old[0]])->assertStatus(422);
        $this->postJson('/api/v1/auth/mfa', ['recovery_code' => $new[0]])->assertOk();
    }

    public function test_turning_it_off_clears_the_codes_and_shuts_staff_out_until_it_is_set_up_again(): void
    {
        [$admin] = $this->protectedAccount(RoleEnum::Admin);

        $this->actingAs($admin)->deleteJson('/api/v1/me/mfa', ['password' => self::PASSWORD])->assertOk();

        $fresh = $admin->fresh();
        $this->assertFalse($fresh->hasTwoFactor());
        $this->assertNull($fresh->mfa_secret);
        $this->assertNull($fresh->mfa_recovery_codes);
        $this->assertNull($fresh->mfa_last_used_step);

        $this->actingAs($fresh)->getJson('/api/v1/admin/orders')->assertStatus(403);
    }

    public function test_a_setup_that_was_started_but_not_confirmed_does_not_open_the_dashboard(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin, ['mfa_secret' => null, 'mfa_confirmed_at' => null]);

        $this->actingAs($admin)->postJson('/api/v1/me/mfa')->assertOk();

        $this->actingAs($admin->fresh())->getJson('/api/v1/admin/orders')->assertStatus(403);
    }

    public function test_the_owner_s_reset_clears_the_recovery_codes_too(): void
    {
        [$user] = $this->protectedAccount();

        $this->artisan('nb:mfa-reset', ['email' => $user->email])->assertSuccessful();

        $this->assertNull($user->fresh()->mfa_recovery_codes);
        $this->assertFalse($user->fresh()->hasTwoFactor());
    }

    public function test_staff_without_it_are_sent_from_google_straight_to_the_setup(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin, ['mfa_secret' => null, 'mfa_confirmed_at' => null]);

        config(['services.google.client_id' => 'test-client', 'services.google.client_secret' => 'test-secret']);
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'test-access-token']),
            'www.googleapis.com/oauth2/v3/userinfo' => Http::response([
                'sub' => 'google-'.$admin->getKey(),
                'email' => $admin->email,
                'email_verified' => true,
                'name' => $admin->name,
            ]),
        ]);

        $this->withSession(['google_oauth_state' => 'test-state'])
            ->get('/api/v1/auth/google/callback?state=test-state&code=test-code')
            ->assertRedirectContains('/dashboard/two-step');

        // Signed in, able to set it up, and still shut out of the dashboard.
        $this->getJson('/api/v1/me')->assertOk();
        $this->postJson('/api/v1/me/mfa')->assertOk();
        $this->getJson('/api/v1/admin/orders')->assertStatus(403);
    }

    public function test_no_secret_or_code_reaches_the_logs_or_the_audit_trail(): void
    {
        $logged = [];
        Event::listen(MessageLogged::class, function (MessageLogged $event) use (&$logged) {
            $logged[] = $event->message.' '.json_encode($event->context);
        });

        $user = $this->customer(['password' => self::PASSWORD]);
        $setup = $this->actingAs($user)->postJson('/api/v1/me/mfa')->json('data');
        $code = Totp::at($setup['secret'], Totp::currentStep());
        $codes = $this->actingAs($user)->postJson('/api/v1/me/mfa/confirm', ['code' => $code])->json('data.recovery_codes');

        $this->coldStart();
        $this->passwordStep($user);
        $this->postJson('/api/v1/auth/mfa', ['code' => '111111']);
        $this->postJson('/api/v1/auth/mfa', ['recovery_code' => $codes[0]])->assertOk();

        $trail = DB::table('audit_logs')->pluck('context')->implode(' ').' '.implode(' ', $logged);

        foreach ([$setup['secret'], $setup['otpauth_uri'], $code, $codes[0], $codes[1]] as $sensitive) {
            $this->assertStringNotContainsString($sensitive, $trail);
        }
    }
}
