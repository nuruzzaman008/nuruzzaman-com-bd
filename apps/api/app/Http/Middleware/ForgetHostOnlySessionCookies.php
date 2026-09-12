<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

/**
 * Deletes the session cookies left behind by the SESSION_DOMAIN change.
 *
 * SESSION_DOMAIN was empty until 12 September 2026, so the session and CSRF
 * cookies were host-only: scoped to nuruzzaman.com.bd alone. Setting it to
 * .nuruzzaman.com.bd did not replace them. A cookie is identified by its name,
 * domain and path together, so the browser kept the old pair and began storing
 * a second pair beside it under the same names.
 *
 * It then sends both, and for two cookies sharing a path it sends the older
 * one first. PHP keeps the first of a repeated name. So every request arrived
 * carrying the stale value, the session behind it was long gone, and a fresh
 * one was started - which is what "signing in again in every new tab" was.
 * Measured on the server: with the stale cookie first a new session file was
 * created every time; with it second, or absent, the session was reused.
 *
 * The old cookies expire on their own two hours after they were last set,
 * because nothing refreshes them any more. This exists so that nobody has to
 * wait that out, or lose a cart or a CSRF token in the meantime.
 *
 * Safe to delete once no browser can still be holding one - any time after
 * 12 September 2026. It only ever removes a cookie with no domain attribute,
 * which is a different cookie from the one the session actually uses.
 */
class ForgetHostOnlySessionCookies
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $domain = config('session.domain');

        // Nothing to undo if the cookies are host-only by configuration.
        if (! $domain) {
            return $response;
        }

        foreach ([config('session.cookie'), 'XSRF-TOKEN'] as $name) {
            // Only worth a header if the browser is sending something by that
            // name at all. It may be the good cookie rather than the stale one;
            // deleting a host-only cookie that is not there costs nothing.
            if (! $name || ! $request->cookies->has($name)) {
                continue;
            }

            $response->headers->setCookie(
                Cookie::create($name)
                    ->withValue(null)
                    ->withExpires(1)
                    ->withPath((string) config('session.path', '/'))
                    // The whole point: no domain, so this matches only the
                    // host-only cookie and never the one in use.
                    ->withDomain(null)
                    ->withSecure((bool) config('session.secure', true))
                    ->withHttpOnly($name !== 'XSRF-TOKEN')
                    ->withSameSite((string) config('session.same_site', 'lax'))
            );
        }

        return $response;
    }
}
