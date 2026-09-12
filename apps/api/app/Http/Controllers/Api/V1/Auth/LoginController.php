<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\Commerce\CartService;
use App\Support\Audit;
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

    public function __construct(private readonly CartService $carts) {}

    public function store(LoginRequest $request): JsonResponse
    {
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

        if (! Auth::attempt($credentials, (bool) $request->boolean('remember'))) {
            RateLimiter::hit($throttleKey, self::LOCK_MINUTES * 60);

            Audit::record('auth.login_failed', null, ['email' => $credentials['email']]);

            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        // A correct password clears the count, so the stray typos of someone
        // who signs in once a month never accumulate into a lock.
        RateLimiter::clear($throttleKey);

        $user = $request->user();

        if (! $user->isActive()) {
            Auth::logout();

            throw ValidationException::withMessages(['email' => 'This account is not active.']);
        }

        $request->session()->regenerate();

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        if ($token = $request->cookie('cart_token')) {
            $this->carts->merge($this->carts->forToken($token), $user);
        }

        Audit::record('auth.login', $user, [], $user->getKey());

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
