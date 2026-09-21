<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Commerce\CartService;
use App\Support\Audit;
use App\Support\MfaSession;
use App\Support\TwoFactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    /** Failed attempts against one address before it stops accepting any. */
    private const MAX_ATTEMPTS = 3;

    /** How long it then refuses, counted from the first of those attempts. */
    private const LOCK_MINUTES = 15;

    /** Where the half-finished sign-in waits for its code. */
    private const PENDING_KEY = MfaSession::PENDING;

    /** How long that wait may last. */
    private const PENDING_SECONDS = 300;

    public function __construct(private readonly CartService $carts) {}

    public function store(LoginRequest $request): JsonResponse
    {
        // A website action. Without the session Sanctum starts for the site the
        // account used to be created - or the password accepted - and only then
        // did the request fail, on the missing session, with a server error.
        abort_unless($request->hasSession(), 400, 'Sign in and register on the website.');

        $credentials = $request->safe()->only(['email', 'password']);

        /*
          Three guesses per account, then fifteen minutes of nothing.

          Keyed by the address being guessed at rather than by the caller's own,
          so moving between addresses buys an attacker no extra attempts - which
          is the whole point, and is what the per-IP throttle in front of this
          cannot do on its own.

          The lock lifts by itself. A permanent one would hand anyone who knows
          a staff email address a way to keep that person locked out
          indefinitely, which trades an attack we are unlikely to face for one
          that anybody could run. The address is hashed because these keys sit
          in a shared cache and there is no reason to keep readable email
          addresses in it.
        */
        $throttleKey = 'login:'.sha1(Str::lower($credentials['email']));

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            $minutes = (int) ceil(RateLimiter::availableIn($throttleKey) / 60);

            Audit::record('auth.login_locked', null, ['email' => $credentials['email']]);

            throw ValidationException::withMessages([
                'email' => 'Too many failed sign-in attempts. Try again in '
                    .max(1, $minutes).' minute(s).',
            ]);
        }

        // Checked rather than signed in, because an account with two-step
        // verification is not signed in until the code is right.
        if (! Auth::guard('web')->validate($credentials)) {
            RateLimiter::hit($throttleKey, self::LOCK_MINUTES * 60);

            Audit::record('auth.login_failed', null, ['email' => $credentials['email']]);

            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        // A correct password clears the count, so the stray typos of someone
        // who signs in once a month never accumulate into a lock.
        RateLimiter::clear($throttleKey);

        /** @var User $user */
        $user = Auth::guard('web')->getLastAttempted();

        if (! $user->isActive()) {
            throw ValidationException::withMessages(['email' => 'This account is not active.']);
        }

        $remember = (bool) $request->boolean('remember');

        if ($user->hasTwoFactor()) {
            /*
              The password was right, and that is all it is: nothing is signed
              in yet. The session only remembers who is halfway through, for
              five minutes, and the code decides the rest.
            */
            $request->session()->put(self::PENDING_KEY, [
                'id' => $user->getKey(),
                'remember' => $remember,
                'at' => now()->getTimestamp(),
            ]);

            Audit::record('auth.mfa_challenged', $user, [], $user->getKey());

            return response()->json(['data' => ['mfa_required' => true]])
                ->header('Cache-Control', 'no-store');
        }

        return $this->completeSignIn($request, $user, $remember);
    }

    /**
     * The second step: the six-digit code from the authenticator app, or one
     * of the recovery codes when the phone is not to hand.
     *
     * Three wrong answers lock the account's challenge for fifteen minutes,
     * which is what stops a stolen password being walked through the code
     * space, and each code works only once.
     */
    public function challenge(Request $request): JsonResponse
    {
        $input = MfaController::validateSecondFactor($request);

        // Without the website's session there is nothing halfway through to
        // finish, and asking the session store would be a server error.
        if (! $request->hasSession()) {
            throw ValidationException::withMessages([
                'code' => 'Sign in from the website, then enter the code.',
            ]);
        }

        $pending = $request->session()->get(self::PENDING_KEY);

        $user = is_array($pending) && isset($pending['id'])
            ? User::query()->find($pending['id'])
            : null;

        if (! $user || ! $user->hasTwoFactor()
            || now()->getTimestamp() - (int) ($pending['at'] ?? 0) > self::PENDING_SECONDS) {
            $request->session()->forget(self::PENDING_KEY);

            throw ValidationException::withMessages([
                'code' => 'That sign-in expired. Enter your email and password again.',
            ]);
        }

        $throttleKey = 'mfa:'.$user->getKey();

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            Audit::record('auth.mfa_locked', $user, [], $user->getKey());

            throw ValidationException::withMessages([
                'code' => 'Too many wrong codes. Try again in '
                    .max(1, (int) ceil(RateLimiter::availableIn($throttleKey) / 60)).' minute(s).',
            ]);
        }

        $method = TwoFactor::attempt($user, $input['code'] ?? null, $input['recovery_code'] ?? null);

        if ($method === null) {
            RateLimiter::hit($throttleKey, self::LOCK_MINUTES * 60);

            Audit::record('auth.mfa_failed', $user, [], $user->getKey());

            $field = filled($input['code'] ?? null) ? 'code' : 'recovery_code';

            throw ValidationException::withMessages([$field => 'That code is not right.']);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->forget(self::PENDING_KEY);

        if ($method === 'recovery_code') {
            Audit::record('auth.mfa_recovery_code_used', $user, [
                'recovery_codes_left' => TwoFactor::remainingRecoveryCodes($user),
            ], $user->getKey());
        }

        return $this->completeSignIn($request, $user, (bool) ($pending['remember'] ?? false), viaMfa: true);
    }

    /** Signing in for real: new session id, login stamp, cart and audit row. */
    private function completeSignIn(Request $request, User $user, bool $remember, bool $viaMfa = false): JsonResponse
    {
        Auth::guard('web')->login($user, $remember);
        $request->session()->regenerate();

        // This session typed the code, so it may open the dashboard.
        if ($viaMfa) {
            MfaSession::markVerified($request, $user);
        }

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        if ($token = $request->cookie('cart_token')) {
            $this->carts->merge($this->carts->forToken($token), $user);
        }

        Audit::record('auth.login', $user, ['mfa' => $viaMfa], $user->getKey());

        return (new UserResource($user->load('profile', 'roles')))->response();
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        Audit::record('auth.logout', $user, [], $user?->getKey());

        return response()->json(['message' => 'Signed out.']);
    }
}
