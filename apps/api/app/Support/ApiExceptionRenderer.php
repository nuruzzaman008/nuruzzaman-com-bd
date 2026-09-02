<?php

namespace App\Support;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * One JSON error shape for the whole API so the generated TypeScript client can
 * handle every failure the same way:
 *
 *   { "error": { "code", "message", "fields", "request_id" } }
 */
final class ApiExceptionRenderer
{
    public static function render(Throwable $e, Request $request): ?JsonResponse
    {
        if (! $request->is('api/*') && ! $request->expectsJson()) {
            return null;
        }

        [$status, $code, $message, $fields] = self::classify($e);

        $payload = [
            'error' => array_filter([
                'code' => $code,
                'message' => $message,
                'fields' => $fields ?: null,
                'request_id' => $request->header('X-Request-Id'),
            ], fn ($value) => $value !== null),
        ];

        if (config('app.debug') && $status >= 500) {
            $payload['error']['debug'] = [
                'exception' => $e::class,
                'file' => $e->getFile().':'.$e->getLine(),
            ];
        }

        return response()->json($payload, $status);
    }

    /** @return array{0:int,1:string,2:string,3:array<string,array<int,string>>} */
    private static function classify(Throwable $e): array
    {
        return match (true) {
            $e instanceof ValidationException => [422, 'validation_failed', 'The submitted data is not valid.', $e->errors()],
            $e instanceof AuthenticationException => [401, 'unauthenticated', 'Authentication is required.', []],
            $e instanceof AuthorizationException => [403, 'forbidden', $e->getMessage() ?: 'This action is not allowed.', []],
            $e instanceof ModelNotFoundException => [404, 'not_found', 'The requested resource was not found.', []],
            $e instanceof HttpExceptionInterface => [
                $e->getStatusCode(),
                self::codeForStatus($e->getStatusCode()),
                $e->getMessage() ?: self::codeForStatus($e->getStatusCode()),
                [],
            ],
            default => [500, 'server_error', 'An unexpected error occurred.', []],
        };
    }

    private static function codeForStatus(int $status): string
    {
        return match ($status) {
            400 => 'bad_request',
            401 => 'unauthenticated',
            403 => 'forbidden',
            404 => 'not_found',
            409 => 'conflict',
            410 => 'gone',
            422 => 'validation_failed',
            423 => 'locked',
            429 => 'rate_limited',
            default => $status >= 500 ? 'server_error' : 'request_failed',
        };
    }
}
