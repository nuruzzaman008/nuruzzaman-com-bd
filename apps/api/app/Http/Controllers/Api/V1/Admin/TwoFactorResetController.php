<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Mail\TwoFactorResetMail;
use App\Models\User;
use App\Support\Audit;
use App\Support\TwoFactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * A super admin or admin clears another staff member's two-step verification,
 * so they can set it up again on a new phone.
 *
 * Who may reset whom is UserPolicy::resetTwoFactor. On top of that the person
 * doing it types their own current code from their own authenticator app,
 * every time: a password confirmation would stay good for hours, and a stolen
 * session could ride on it. The code works once, and three wrong ones lock
 * this person's codes for fifteen minutes, as at sign-in.
 *
 * The account whose second step was cleared is told by email, so a reset
 * nobody asked for does not go unnoticed.
 */
class TwoFactorResetController extends Controller
{
    private const MAX_ATTEMPTS = 3;

    private const LOCK_SECONDS = 15 * 60;

    public function store(Request $request, User $user): JsonResponse
    {
        $this->authorize('resetTwoFactor', $user);

        $input = $request->validate(['code' => ['required', 'string', 'max:10']]);
        $actor = $request->user();
        $throttleKey = 'mfa:'.$actor->getKey();

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            Audit::record('auth.mfa_locked', $actor, [], $actor->getKey());

            throw ValidationException::withMessages([
                'code' => 'Too many wrong codes. Try again in '
                    .max(1, (int) ceil(RateLimiter::availableIn($throttleKey) / 60)).' minute(s).',
            ]);
        }

        if (! TwoFactor::consumeCode($actor, $input['code'])) {
            RateLimiter::hit($throttleKey, self::LOCK_SECONDS);
            Audit::record('auth.mfa_failed', $actor, ['for' => 'staff_reset', 'target' => $user->getKey()], $actor->getKey());

            throw ValidationException::withMessages([
                'code' => 'That code from your authenticator app is not right.',
            ]);
        }

        RateLimiter::clear($throttleKey);

        $hadTwoFactor = $user->hasTwoFactor();
        TwoFactor::clear($user);

        Audit::record('auth.mfa_reset_by_staff', $user, [
            'by' => $actor->getKey(),
            'had_two_factor' => $hadTwoFactor,
        ], $actor->getKey());

        Mail::to($user->email)->queue(new TwoFactorResetMail($user, $actor->name));

        return response()->json(['data' => new UserResource($user->fresh()->load('profile', 'roles'))]);
    }
}
