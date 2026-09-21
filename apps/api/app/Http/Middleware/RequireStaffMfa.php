<?php

namespace App\Http\Middleware;

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

        if ($user && $request->is('api/v1/admin/*') && $user->isStaff() && ! $user->hasTwoFactor()) {
            abort(403, 'Two-step verification is required for staff. Set it up in Dashboard → Security.');
        }

        return $next($request);
    }
}
