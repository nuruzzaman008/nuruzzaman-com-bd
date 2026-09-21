<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Support\Audit;
use App\Support\MfaSession;
use App\Support\Totp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Two-step verification with an authenticator app.
 *
 * Staff must have it on: a stolen or guessed staff password otherwise reaches
 * the dashboard, and from there the code every page of the site loads (see
 * RequireStaffMfa). Customers may turn it on and are not forced to.
 *
 * The secret is stored encrypted and shown exactly once, while it is being set
 * up. If a phone is lost, the owner clears it on the server with
 * `php artisan nb:mfa-reset <email>`; nothing on the website can.
 */
class MfaController extends Controller
{
    /** Starts the setup and hands back the secret for the app. */
    public function start(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasTwoFactor()) {
            throw ValidationException::withMessages([
                'code' => 'Two-step verification is already on. Turn it off before setting up a new app.',
            ]);
        }

        $secret = Totp::generateSecret();
        $user->forceFill(['mfa_secret' => $secret])->save();

        Audit::record('auth.mfa_setup_started', $user, [], $user->getKey());

        return response()->json(['data' => [
            'secret' => $secret,
            'otpauth_uri' => Totp::uri($secret, $user->email, (string) config('nb.site.name', 'nuruzzaman.com.bd')),
        ]])->header('Cache-Control', 'no-store');
    }

    /** Proves the app is set up correctly before the account depends on it. */
    public function confirm(Request $request): JsonResponse
    {
        $input = $request->validate(['code' => ['required', 'string', 'max:10']]);
        $user = $request->user();

        if (! $user->mfa_secret) {
            throw ValidationException::withMessages([
                'code' => 'Start the setup first, then enter the code the app shows.',
            ]);
        }

        if (! Totp::verify((string) $user->mfa_secret, $input['code'])) {
            throw ValidationException::withMessages([
                'code' => 'That code is not right. Check the clock on your phone and try the next one.',
            ]);
        }

        $user->forceFill(['mfa_confirmed_at' => now()])->save();

        // The code was just typed into this session.
        MfaSession::markVerified($request, $user);

        Audit::record('auth.mfa_enabled', $user, [], $user->getKey());

        return response()->json(['data' => ['mfa_enabled' => true]]);
    }

    /**
     * Asks a signed-in session for the code when it got in without one: through
     * Google, through a remember-me cookie, or from before two-step
     * verification existed. Three wrong codes lock it for fifteen minutes, as
     * at sign-in.
     */
    public function verify(Request $request): JsonResponse
    {
        $input = $request->validate(['code' => ['required', 'string', 'max:10']]);
        $user = $request->user();

        if (! $user->hasTwoFactor()) {
            throw ValidationException::withMessages([
                'code' => 'Set up two-step verification first.',
            ]);
        }

        $throttleKey = 'mfa:'.$user->getKey();

        if (RateLimiter::tooManyAttempts($throttleKey, 3)) {
            Audit::record('auth.mfa_locked', $user, [], $user->getKey());

            throw ValidationException::withMessages([
                'code' => 'Too many wrong codes. Try again in '
                    .max(1, (int) ceil(RateLimiter::availableIn($throttleKey) / 60)).' minute(s).',
            ]);
        }

        if (! Totp::verify((string) $user->mfa_secret, $input['code'])) {
            RateLimiter::hit($throttleKey, 15 * 60);
            Audit::record('auth.mfa_failed', $user, ['step_up' => true], $user->getKey());

            throw ValidationException::withMessages(['code' => 'That code is not right.']);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->regenerate();
        MfaSession::markVerified($request, $user);

        Audit::record('auth.mfa_verified', $user, ['step_up' => true], $user->getKey());

        return response()->json(['data' => ['mfa_session_verified' => true]]);
    }

    /**
     * Turning it off needs the password and a session that has typed a code.
     * With the password alone, a stolen remember-me cookie plus a leaked
     * password could switch it off and set up an app of their own.
     */
    public function destroy(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);

        $user = $request->user();

        if ($user->hasTwoFactor() && ! MfaSession::isVerified($request, $user)) {
            abort(403, 'Enter the code from your authenticator app first.');
        }

        $user->forceFill(['mfa_secret' => null, 'mfa_confirmed_at' => null])->save();
        $request->session()->forget(MfaSession::VERIFIED);

        Audit::record('auth.mfa_disabled', $user, [], $user->getKey());

        return response()->json(['data' => ['mfa_enabled' => false]]);
    }
}
