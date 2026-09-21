<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Support\Audit;
use App\Support\Totp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

        Audit::record('auth.mfa_enabled', $user, [], $user->getKey());

        return response()->json(['data' => ['mfa_enabled' => true]]);
    }

    /** Turning it off needs the password, so a borrowed session cannot. */
    public function destroy(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);

        $user = $request->user();
        $user->forceFill(['mfa_secret' => null, 'mfa_confirmed_at' => null])->save();

        Audit::record('auth.mfa_disabled', $user, [], $user->getKey());

        return response()->json(['data' => ['mfa_enabled' => false]]);
    }
}
