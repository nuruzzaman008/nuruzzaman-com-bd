<?php

namespace App\Http\Middleware;

use App\Support\MfaSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The dashboard is for staff with two-step verification on, and nobody else.
 *
 * An admin account can put JavaScript on every page of the site, approve
 * payments and read every order, so a password on its own is not enough to
 * open it. Staff can still sign in and use their own account; only the admin
 * API is closed until the second step is set up, which the dashboard offers
 * them on arrival.
 *
 * Checked here rather than on each route so a new admin route cannot be added
 * without it.
 */
class RequireStaffMfa
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');

        if (! $user || ! $request->is('api/v1/admin/*') || ! $user->isStaff()) {
            return $next($request);
        }

        if (! $user->hasTwoFactor()) {
            abort(403, 'Two-step verification is required for staff. Set it up in Dashboard → Security.');
        }

        /*
          Having the app set up is not enough: this session must have seen a
          code. Otherwise a staff account opened through Google, or through a
          remember-me cookie, would walk past the second step entirely. There is
          no session-less way into the admin API, so no session means no entry.
        */
        if (! MfaSession::isVerified($request, $user)) {
            abort(403, 'Enter the code from your authenticator app to continue.');
        }

        return $next($request);
    }
}
