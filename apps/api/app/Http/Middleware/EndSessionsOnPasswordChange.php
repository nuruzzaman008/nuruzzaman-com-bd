<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * A session only lasts as long as the password it was signed in with.
 *
 * Each session remembers that password's hash. Changing or resetting the
 * password writes a new one, so every other session - the phone left at a
 * repair shop, the browser in an internet cafe, whoever took the password -
 * stops working on its next request. The device doing the changing carries on,
 * because the new hash is written back into its session on the way out.
 *
 * Laravel ships AuthenticateSession for this, but it reads whichever guard is
 * default at the time, and `auth:sanctum` makes that Sanctum's request guard,
 * which has no session to speak of. This asks the session guard directly.
 */
class EndSessionsOnPasswordChange
{
    private const KEY = 'nb.password_hash';

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->hasSession()) {
            return $next($request);
        }

        $guard = Auth::guard('web');
        $user = $guard->user();

        if (! $user || ! $user->getAuthPassword()) {
            return $next($request);
        }

        $stored = $request->session()->get(self::KEY);

        if (is_string($stored) && ! hash_equals($stored, $user->getAuthPassword())) {
            $guard->logout();
            $request->session()->flush();
            $request->session()->regenerateToken();

            throw new AuthenticationException('The password for this account changed, so this session has ended.');
        }

        return tap($next($request), function () use ($request, $guard) {
            // After the response, so a request that changes the password stores
            // the hash it ends with rather than the one it started with.
            $current = $guard->user();

            if ($current && $current->getAuthPassword()) {
                $request->session()->put(self::KEY, $current->getAuthPassword());
            }
        });
    }
}
