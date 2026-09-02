<?php

namespace App\Services\Content;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Calls the signed Next.js revalidation endpoint so published changes appear on
 * cached public pages without waiting for a time-based revalidation.
 *
 * The request is signed with an HMAC over the body; the frontend rejects
 * anything it cannot verify, so this endpoint cannot be used to force cache
 * churn from the internet.
 */
class RevalidationService
{
    /** @param array<int, string> $tags */
    public function revalidate(array $tags): bool
    {
        $endpoint = config('nb.revalidation.endpoint');
        $secret = config('nb.revalidation.secret');

        if (blank($endpoint) || blank($secret)) {
            Log::info('Frontend revalidation skipped: endpoint or secret not configured.', ['tags' => $tags]);

            return false;
        }

        $body = json_encode(['tags' => array_values(array_unique($tags)), 'at' => now()->toIso8601String()], JSON_THROW_ON_ERROR);
        $signature = hash_hmac('sha256', $body, $secret);

        $response = Http::timeout(10)
            ->withHeaders([
                'Content-Type' => 'application/json',
                'X-Revalidate-Signature' => $signature,
            ])
            ->withBody($body, 'application/json')
            ->post($endpoint);

        if ($response->failed()) {
            Log::warning('Frontend revalidation failed.', [
                'status' => $response->status(),
                'tags' => $tags,
            ]);
        }

        return $response->successful();
    }
}
