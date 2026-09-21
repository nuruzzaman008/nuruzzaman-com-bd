<?php

use App\Http\Middleware\AttachRequestId;
use App\Http\Middleware\EndSessionsOnPasswordChange;
use App\Http\Middleware\EnforceIdempotency;
use App\Http\Middleware\EnsureUserHasPermission;
use App\Http\Middleware\EnsureUserHasRole;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\ForgetHostOnlySessionCookies;
use App\Http\Middleware\RequireStaffMfa;
use App\Http\Middleware\SecurityHeaders;
use App\Support\ApiExceptionRenderer;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // Two-step verification lives in its own route file; see routes/api_mfa.php.
        then: fn () => Route::middleware('api')->prefix('api/v1')->group(base_path('routes/api_mfa.php')),
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // First-party cookie session auth for the Next.js frontend (Sanctum).
        $middleware->statefulApi();

        /*
          A session carries the password hash it was signed in with, so changing
          or resetting a password ends every other session by itself - the phone
          left at a repair shop, the browser in an internet cafe, or whoever
          took the password. The current device stays signed in, because
          logoutOtherDevices refreshes this session's copy.
        */
        $middleware->api(append: [
            EndSessionsOnPasswordChange::class,
            // The dashboard needs two-step verification; see the class.
            RequireStaffMfa::class,
        ]);

        $middleware->api(prepend: [
            AttachRequestId::class,
            SecurityHeaders::class,
            // Outermost, so it can add to the finished response. Temporary -
            // see the class for when it can go.
            ForgetHostOnlySessionCookies::class,
        ]);

        // Sanctum's /sanctum/csrf-cookie is a web-group route, and it is the
        // first thing a browser asks for - so the cleanup has to be here too
        // or it would only ever reach client-side API calls.
        $middleware->web(prepend: [
            ForgetHostOnlySessionCookies::class,
        ]);

        $middleware->alias([
            'active' => EnsureUserIsActive::class,
            'role' => EnsureUserHasRole::class,
            'permission' => EnsureUserHasPermission::class,
            'idempotent' => EnforceIdempotency::class,
        ]);

        // Payment callbacks are signed server-to-server posts, not browser forms.
        $middleware->validateCsrfTokens(except: [
            'api/v1/payments/*/ipn',
        ]);

        // The gateway's signature covers the fields exactly as it sent them.
        // Trimming a value or turning an empty one into null would break a
        // genuine signature, so the IPN is read untouched.
        $isPaymentCallback = fn (Request $request) => $request->is('api/v1/payments/*/ipn');
        $middleware->trimStrings(except: [$isPaymentCallback]);
        $middleware->convertEmptyStringsToNull(except: [$isPaymentCallback]);

        // Trusted proxies come from config/trustedproxy.php, never '*': trusting
        // every address let any visitor choose the IP the rate limits count.

        /*
         * There is no Laravel login page: the sign-in form is in the Next.js
         * app and this project serves JSON only. Laravel's auth middleware
         * otherwise redirects an unauthenticated visitor to route('login'),
         * which does not exist here, so any request that did not ask for JSON
         * — a browser address bar, a link, a crawler — got a 500 instead of a
         * 401. Returning null stops the redirect and lets the exception
         * renderer answer with the same 401 envelope as every other client.
         */
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Two-step codes are never written back into the session with the rest
        // of a failed form, the way Laravel does for input it redisplays.
        $exceptions->dontFlash(['code', 'recovery_code', 'password', 'current_password', 'password_confirmation']);

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (Throwable $e, Request $request) {
            return ApiExceptionRenderer::render($e, $request);
        });
    })->create();
