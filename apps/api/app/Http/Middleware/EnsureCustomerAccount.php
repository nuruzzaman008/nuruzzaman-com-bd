<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCustomerAccount
{
    public function handle(Request $request, Closure $next): Response
    {
        $customerRoute = $request->is('api/v1/account/*');
        $switchingMode = $request->is('api/v1/me') && $request->isMethod('PATCH') && $request->exists('account_mode');
        abort_if(($customerRoute || $switchingMode) && $request->user()?->hasRole('admin', 'super_admin'), 403, 'Administrators use the admin dashboard, not a customer account.');

        return $next($request);
    }
}
