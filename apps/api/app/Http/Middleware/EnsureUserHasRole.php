<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Coarse gate for the admin surface. Fine-grained checks still run in policies
 * at the data source - this only keeps unrelated roles out of /admin entirely.
 */
class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! $user->hasRole(...$roles)) {
            abort(403, 'You do not have access to this area.');
        }

        return $next($request);
    }
}
