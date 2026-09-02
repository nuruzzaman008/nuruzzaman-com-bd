<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Every request carries a correlation id that appears in structured logs, audit
 * rows and the response header, so a customer report can be traced end to end.
 */
class AttachRequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $requestId = $request->header('X-Request-Id');

        if (! $requestId || ! preg_match('/^[A-Za-z0-9\-]{8,64}$/', $requestId)) {
            $requestId = (string) Str::uuid();
        }

        $request->headers->set('X-Request-Id', $requestId);
        Log::shareContext(['request_id' => $requestId]);

        $response = $next($request);
        $response->headers->set('X-Request-Id', $requestId);

        return $response;
    }
}
