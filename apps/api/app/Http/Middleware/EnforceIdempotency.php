<?php

namespace App\Http\Middleware;

use App\Models\IdempotencyKey;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Payment-sensitive mutations must be safe to retry. The first request for a
 * key runs and stores its response; a repeat of the same key and body replays
 * that response, and the same key with a different body is rejected.
 */
class EnforceIdempotency
{
    public function handle(Request $request, Closure $next, string $scope = 'default'): Response
    {
        $key = $request->header('Idempotency-Key');

        if (! $key) {
            return $next($request);
        }

        if (! preg_match('/^[A-Za-z0-9._\-]{8,128}$/', $key)) {
            abort(422, 'Idempotency-Key must be 8-128 characters of [A-Za-z0-9._-].');
        }

        $hash = hash('sha256', $request->getContent() ?: '{}');

        /** @var IdempotencyKey|null $existing */
        $existing = IdempotencyKey::query()->where('scope', $scope)->where('key', $key)->first();

        if ($existing) {
            if ($existing->request_hash !== $hash) {
                abort(409, 'This Idempotency-Key was already used with a different request body.');
            }

            if ($existing->completed_at && $existing->response_status) {
                return response(
                    $existing->response_body ?? '',
                    $existing->response_status,
                )->header('Content-Type', 'application/json')
                    ->header('Idempotency-Replayed', 'true');
            }

            abort(409, 'A request with this Idempotency-Key is still in progress.');
        }

        $record = IdempotencyKey::create([
            'key' => $key,
            'scope' => $scope,
            'user_id' => $request->user()?->getKey(),
            'method' => $request->method(),
            'path' => $request->path(),
            'request_hash' => $hash,
            'locked_at' => now(),
        ]);

        $response = $next($request);

        // Only successful responses are memoised; a failure must be retryable.
        if ($response->getStatusCode() < 400) {
            DB::transaction(fn () => $record->update([
                'response_status' => $response->getStatusCode(),
                'response_body' => $response->getContent(),
                'completed_at' => now(),
            ]));
        } else {
            $record->delete();
        }

        return $response;
    }
}
