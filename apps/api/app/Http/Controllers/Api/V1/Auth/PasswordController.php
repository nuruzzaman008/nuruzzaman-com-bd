<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Support\Audit;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class PasswordController extends Controller
{
    public function forgot(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email', 'max:191']]);

        Password::sendResetLink($request->only('email'));

        // Always the same answer, so this endpoint cannot enumerate accounts.
        return response()->json([
            'message' => 'If that email is registered, a reset link is on its way.',
        ]);
    }

    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email', 'max:191'],
            'password' => ['required', 'confirmed', PasswordRule::min(10)->letters()->numbers()->uncompromised()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
                Audit::record('auth.password_reset', $user, [], $user->getKey());
            },
        );

        if ($status !== Password::PasswordReset) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return response()->json(['message' => 'Password updated.']);
    }

    /** Re-confirms the current password before a sensitive action. */
    public function confirm(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'string']]);

        if (! Hash::check($request->input('password'), $request->user()->password)) {
            throw ValidationException::withMessages(['password' => 'That password is incorrect.']);
        }

        $request->session()->put('auth.password_confirmed_at', time());

        return response()->json(['message' => 'Password confirmed.']);
    }

    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', PasswordRule::min(10)->letters()->numbers()->uncompromised()],
        ]);

        $request->user()->update(['password' => $request->input('password')]);
        Audit::record('auth.password_changed', $request->user(), [], $request->user()->getKey());

        return response()->json(['message' => 'Password changed.']);
    }
}
