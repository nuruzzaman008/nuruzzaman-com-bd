<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Growth\GmailConnection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GrowthGmailController extends Controller
{
    public function __construct(private readonly GmailConnection $gmail) {}

    public function status(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->gmail->status((int) $request->user()->id)]);
    }

    public function start(Request $request): JsonResponse
    {
        abort_unless($this->gmail->configured(), 422, 'Google OAuth is not configured. A Gemini API key cannot connect Gmail.');
        $state = Str::random(64);
        $verifier = Str::random(64);
        $request->session()->put('growth_gmail_oauth', [
            'state' => $state, 'verifier' => $verifier, 'user_id' => $request->user()->id, 'expires' => now()->addMinutes(10)->timestamp,
        ]);
        $url = 'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query([
            'client_id' => config('services.google.client_id'), 'redirect_uri' => $this->gmail->callbackUrl(),
            'response_type' => 'code', 'scope' => GmailConnection::SCOPE, 'state' => $state,
            'access_type' => 'offline', 'prompt' => 'consent select_account',
            'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='),
            'code_challenge_method' => 'S256',
        ]);

        return response()->json(['data' => ['url' => $url]]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $pending = $request->session()->pull('growth_gmail_oauth');
        $result = 'failed';
        if (is_array($pending) && ($pending['user_id'] ?? null) === $request->user()->id &&
            ($pending['expires'] ?? 0) >= now()->timestamp &&
            is_string($request->query('state')) && hash_equals($pending['state'], $request->query('state'))) {
            if ($request->query('error') === 'access_denied') {
                $result = 'cancelled';
            } elseif (is_string($request->query('code')) && $request->query('code') !== '') {
                try {
                    $this->gmail->connect((int) $request->user()->id, $request->query('code'), $pending['verifier']);
                    $result = 'connected';
                } catch (\Throwable) {
                    $result = 'failed';
                }
            }
        }

        return redirect()->away(rtrim((string) config('nb.site.url'), '/').'/dashboard/growth-hub?gmail='.$result);
    }

    public function check(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->gmail->check((int) $request->user()->id)]);
    }

    public function disconnect(Request $request): JsonResponse
    {
        $request->session()->forget('growth_gmail_oauth');
        $this->gmail->disconnect((int) $request->user()->id);

        return $this->status($request);
    }
}
