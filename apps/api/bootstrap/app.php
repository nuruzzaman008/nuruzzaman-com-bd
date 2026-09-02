<?php

use App\Http\Middleware\AttachRequestId;
use App\Http\Middleware\EnforceIdempotency;
use App\Http\Middleware\EnsureUserHasPermission;
use App\Http\Middleware\EnsureUserHasRole;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\SecurityHeaders;
use App\Support\ApiExceptionRenderer;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // First-party cookie session auth for the Next.js frontend (Sanctum).
        $middleware->statefulApi();

        $middleware->api(prepend: [
            AttachRequestId::class,
            SecurityHeaders::class,
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

        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (Throwable $e, Request $request) {
            return ApiExceptionRenderer::render($e, $request);
        });
    })->create();
