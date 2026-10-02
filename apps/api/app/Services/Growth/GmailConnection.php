<?php

namespace App\Services\Growth;

use App\Support\Audit;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GmailConnection
{
    public const SCOPE = 'https://www.googleapis.com/auth/gmail.metadata';

    public function configured(): bool
    {
        return (bool) (config('services.google.client_id') && config('services.google.client_secret'));
    }

    public function callbackUrl(): string
    {
        return rtrim((string) config('nb.site.url'), '/').'/api/v1/admin/growth-hub/gmail/callback';
    }

    public function status(int $userId): array
    {
        $row = DB::table('growth_gmail_connections')->where('user_id', $userId)->first();

        return ['configured' => $this->configured(), 'status' => $row?->status ?? 'disconnected',
            'email' => $row?->email, 'checked_at' => $row?->checked_at,
            'callback_url' => $this->callbackUrl()];
    }

    public function connect(int $userId, string $code, string $verifier): void
    {
        $response = Http::asForm()->timeout(15)->post('https://oauth2.googleapis.com/token', [
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'redirect_uri' => $this->callbackUrl(), 'grant_type' => 'authorization_code',
            'code' => $code, 'code_verifier' => $verifier,
        ]);
        $tokens = $response->json();
        if (! $response->successful() || ! is_array($tokens) ||
            empty($tokens['access_token']) || empty($tokens['refresh_token']) ||
            ! in_array(self::SCOPE, explode(' ', $tokens['scope'] ?? ''), true)) {
            throw new RuntimeException('Gmail consent was not completed.');
        }
        $email = $this->profile($tokens['access_token']);
        DB::transaction(function () use ($userId, $tokens, $email): void {
            DB::table('growth_gmail_connections')->updateOrInsert(['user_id' => $userId], [
                'email' => $email,
                'credentials' => Crypt::encryptString(json_encode([
                    'access_token' => $tokens['access_token'], 'refresh_token' => $tokens['refresh_token'],
                ], JSON_THROW_ON_ERROR)),
                'status' => 'connected', 'expires_at' => now()->addSeconds(max(1, (int) ($tokens['expires_in'] ?? 3600))),
                'checked_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            Audit::record('growth.gmail.connected', userId: $userId);
        });
    }

    private function profile(string $token): string
    {
        $profile = Http::withToken($token)->timeout(15)->get('https://gmail.googleapis.com/gmail/v1/users/me/profile');
        $email = $profile->json('emailAddress');
        if (! $profile->successful() || ! is_string($email) || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Gmail API access could not be verified.');
        }

        return $email;
    }

    public function check(int $userId): array
    {
        DB::transaction(function () use ($userId): void {
            $row = DB::table('growth_gmail_connections')->where('user_id', $userId)->lockForUpdate()->first();
            if (! $row) {
                return;
            }
            try {
                $tokens = json_decode(Crypt::decryptString($row->credentials), true, 512, JSON_THROW_ON_ERROR);
                if (now()->addMinute()->greaterThanOrEqualTo($row->expires_at)) {
                    $response = Http::asForm()->timeout(15)->post('https://oauth2.googleapis.com/token', [
                        'client_id' => config('services.google.client_id'), 'client_secret' => config('services.google.client_secret'),
                        'grant_type' => 'refresh_token', 'refresh_token' => $tokens['refresh_token'],
                    ]);
                    if (! $response->successful() || ! $response->json('access_token')) {
                        throw new RuntimeException('Reconnect Gmail.');
                    }
                    $tokens['access_token'] = $response->json('access_token');
                    DB::table('growth_gmail_connections')->where('id', $row->id)->update([
                        'credentials' => Crypt::encryptString(json_encode($tokens, JSON_THROW_ON_ERROR)),
                        'expires_at' => now()->addSeconds(max(1, (int) $response->json('expires_in', 3600))),
                    ]);
                }
                $email = $this->profile($tokens['access_token']);
                if (strcasecmp($email, $row->email) !== 0) {
                    throw new RuntimeException('Account mismatch.');
                }
                DB::table('growth_gmail_connections')->where('id', $row->id)->update([
                    'status' => 'connected', 'checked_at' => now(), 'updated_at' => now(),
                ]);
            } catch (\Throwable) {
                // Never log OAuth responses or exception text containing credentials.
                DB::table('growth_gmail_connections')->where('id', $row->id)->update([
                    'status' => 'verification_failed', 'updated_at' => now(),
                ]);
            }
        });

        return $this->status($userId);
    }

    public function disconnect(int $userId): void
    {
        DB::transaction(function () use ($userId): void {
            DB::table('growth_gmail_connections')->where('user_id', $userId)->delete();
            Audit::record('growth.gmail.disconnected', userId: $userId);
        });
    }
}
