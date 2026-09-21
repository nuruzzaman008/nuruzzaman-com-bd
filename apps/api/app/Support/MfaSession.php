<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * What a session knows about two-step verification.
 *
 * Having an authenticator set up says nothing about the session in front of
 * us. A session only counts as verified once its own holder has typed a code
 * into it: after the password and the code, after confirming the app, or
 * after being asked again. A session that got in any other way - Google,
 * a remember-me cookie, whatever sign-in path is added next year - has
 * not, and the dashboard asks it for the code before it opens.
 */
final class MfaSession
{
    /** The half-finished sign-in waiting for its code. */
    public const PENDING = 'auth.mfa_pending';

    /** The id of the account whose code this session has seen. */
    public const VERIFIED = 'auth.mfa_verified';

    public static function markVerified(Request $request, User $user): void
    {
        $request->session()->put(self::VERIFIED, $user->getKey());
    }

    public static function isVerified(Request $request, User $user): bool
    {
        return $request->hasSession()
            && $request->session()->get(self::VERIFIED) === $user->getKey();
    }
}
