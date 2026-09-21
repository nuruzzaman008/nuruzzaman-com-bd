<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Audit;
use App\Support\MfaSession;
use App\Support\Totp;
use App\Support\TwoFactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Two-step verification with an authenticator app (Google Authenticator or
 * any other that reads a TOTP QR code).
 *
 * Staff must have it on: a stolen or guessed staff password otherwise reaches
 * the dashboard, and from there the code every page of the site loads (see
 * RequireStaffMfa). Customers may turn it on and are not forced to.
 *
 * Every endpoint acts on the signed-in account only, so nobody can reach
 * another person's secret or codes. The secret is stored encrypted and is
 * shown exactly once, while it is being set up; the recovery codes likewise,
 * when they are made. If both the phone and the codes are lost, the owner
 * clears it on the server with `php artisan nb:mfa-reset <email>`.
 */
class MfaController extends Controller
{
    /** Wrong codes, per account, before a lock. */
    private const MAX_ATTEMPTS = 3;

    /** Setting up allows a few more, because the first scan is often fumbled. */
    private const MAX_SETUP_ATTEMPTS = 5;

    private const LOCK_SECONDS = 15 * 60;

    /** Starts the setup and hands back the secret and QR address for the app. */
    public function start(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasTwoFactor()) {
            throw ValidationException::withMessages([
                'code' => 'Two-step verification is already on. Turn it off before setting up a new app.',
            ]);
        }

        // A new secret each time: a setup that was abandoned, or seen by
        // someone else, is worth nothing once it is restarted.
        $secret = Totp::generateSecret();
        $user->forceFill([
            'mfa_secret' => $secret,
            'mfa_confirmed_at' => null,
            'mfa_recovery_codes' => null,
            'mfa_last_used_step' => null,
        ])->save();

        Audit::record('auth.mfa_setup_started', $user, [], $user->getKey());

        return response()->json(['data' => [
            'secret' => $secret,
            'otpauth_uri' => Totp::uri($secret, $user->email, $this->issuer()),
            'issuer' => $this->issuer(),
            'account' => $user->email,
        ]])->header('Cache-Control', 'no-store');
    }

    /**
     * Proves the app is set up correctly before the account depends on it,
     * then turns two-step verification on and hands out the recovery codes.
     */
    public function confirm(Request $request): JsonResponse
    {
        $input = $request->validate(['code' => ['required', 'string', 'max:10']]);
        $user = $request->user();

        if ($user->hasTwoFactor()) {
            throw ValidationException::withMessages([
                'code' => 'Two-step verification is already on.',
            ]);
        }

        if (! $user->mfa_secret) {
            throw ValidationException::withMessages([
                'code' => 'Start the setup first, then enter the code the app shows.',
            ]);
        }

        $throttleKey = 'mfa-setup:'.$user->getKey();
        $this->ensureNotLocked($throttleKey, self::MAX_SETUP_ATTEMPTS, $user);

        if (! TwoFactor::consumeCode($user, $input['code'])) {
            RateLimiter::hit($throttleKey, self::LOCK_SECONDS);

            throw ValidationException::withMessages([
                'code' => 'That code is not right. Check the clock on your phone and try the next one.',
            ]);
        }

        RateLimiter::clear($throttleKey);
        $user->forceFill(['mfa_confirmed_at' => now()])->save();
        $codes = TwoFactor::generateRecoveryCodes($user);

        // The code was just typed into this session.
        MfaSession::markVerified($request, $user);

        Audit::record('auth.mfa_enabled', $user, [], $user->getKey());

        return response()->json(['data' => [
            'mfa_enabled' => true,
            'recovery_codes' => $codes,
        ]])->header('Cache-Control', 'no-store');
    }

    /**
     * Asks a signed-in session for the code when it got in without one: through
     * a remember-me cookie, or from before two-step verification existed. A
     * recovery code works here too. Three wrong answers lock it for fifteen
     * minutes, as at sign-in.
     */
    public function verify(Request $request): JsonResponse
    {
        $input = $this->validateSecondFactor($request);
        $user = $request->user();

        if (! $user->hasTwoFactor()) {
            throw ValidationException::withMessages([
                'code' => 'Set up two-step verification first.',
            ]);
        }

        $throttleKey = 'mfa:'.$user->getKey();
        $this->ensureNotLocked($throttleKey, self::MAX_ATTEMPTS, $user);

        $method = TwoFactor::attempt($user, $input['code'] ?? null, $input['recovery_code'] ?? null);

        if ($method === null) {
            RateLimiter::hit($throttleKey, self::LOCK_SECONDS);
            Audit::record('auth.mfa_failed', $user, ['step_up' => true], $user->getKey());

            $field = filled($input['code'] ?? null) ? 'code' : 'recovery_code';

            throw ValidationException::withMessages([$field => 'That code is not right.']);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->regenerate();
        MfaSession::markVerified($request, $user);

        Audit::record('auth.mfa_verified', $user, [
            'step_up' => true,
            'method' => $method,
            'recovery_codes_left' => TwoFactor::remainingRecoveryCodes($user),
        ], $user->getKey());

        return response()->json(['data' => ['mfa_session_verified' => true]]);
    }

    /**
     * A new set of recovery codes, replacing the old. Needs the password and a
     * session that has typed a code: a borrowed session must not be able to
     * mint itself a way back in.
     */
    public function recoveryCodes(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);
        $user = $request->user();

        if (! $user->hasTwoFactor()) {
            throw ValidationException::withMessages([
                'password' => 'Two-step verification is not on for this account.',
            ]);
        }

        $this->ensureVerifiedSession($request, $user);

        $codes = TwoFactor::generateRecoveryCodes($user);

        Audit::record('auth.mfa_recovery_codes_regenerated', $user, [], $user->getKey());

        return response()->json(['data' => ['recovery_codes' => $codes]])
            ->header('Cache-Control', 'no-store');
    }

    /**
     * Turning it off needs the password and a session that has typed a code.
     * With the password alone, a stolen remember-me cookie plus a leaked
     * password could switch it off and set up an app of their own. Staff who
     * turn it off are shut out of the dashboard until they set it up again,
     * which is also how a phone is replaced.
     */
    public function destroy(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);

        $user = $request->user();

        if ($user->hasTwoFactor()) {
            $this->ensureVerifiedSession($request, $user);
        }

        TwoFactor::clear($user);
        $request->session()->forget(MfaSession::VERIFIED);

        Audit::record('auth.mfa_disabled', $user, [], $user->getKey());

        return response()->json(['data' => ['mfa_enabled' => false]]);
    }

    /**
     * The second step as the forms send it: the app's six digits, or a recovery
     * code instead.
     *
     * @return array{code?: string|null, recovery_code?: string|null}
     */
    public static function validateSecondFactor(Request $request): array
    {
        return $request->validate([
            'code' => ['nullable', 'required_without:recovery_code', 'string', 'max:10'],
            'recovery_code' => ['nullable', 'required_without:code', 'string', 'max:40'],
        ]);
    }

    private function ensureVerifiedSession(Request $request, User $user): void
    {
        if (! MfaSession::isVerified($request, $user)) {
            abort(403, 'Enter the code from your authenticator app first.');
        }
    }

    private function ensureNotLocked(string $throttleKey, int $maxAttempts, User $user): void
    {
        if (RateLimiter::tooManyAttempts($throttleKey, $maxAttempts)) {
            Audit::record('auth.mfa_locked', $user, [], $user->getKey());

            throw ValidationException::withMessages([
                'code' => 'Too many wrong codes. Try again in '
                    .max(1, (int) ceil(RateLimiter::availableIn($throttleKey) / 60)).' minute(s).',
            ]);
        }
    }

    private function issuer(): string
    {
        return (string) config('nb.mfa_issuer', 'nuruzzaman.com.bd');
    }
}
