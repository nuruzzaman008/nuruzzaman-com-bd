<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * The profile photo from a Google account, for an account that has none.
 *
 * Google's userinfo carries a `picture` address; nothing used to read it, so
 * everyone who signed in with Google stayed a letter in a circle. It is
 * fetched server side once, when the account has no photo, and kept on the
 * private disk like an uploaded one. A photo the person uploaded themselves is
 * never replaced.
 *
 * Only Google's own image servers are asked, over https, with a short
 * timeout and a size cap, and the reply must be a real JPEG, PNG or WebP: the
 * address arrives from Google, but it is still an address this server fetches.
 * Nothing here may stop a sign-in - on any failure the photo is simply left
 * out.
 */
class GoogleAvatar
{
    private const MAX_BYTES = 2 * 1024 * 1024;

    /** Google image CDN hosts all end with this. */
    private const HOST_SUFFIX = '.googleusercontent.com';

    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function importIfMissing(User $user, ?string $pictureUrl): void
    {
        try {
            $url = $this->safeUrl($pictureUrl);

            if (! $url || filled($user->profile()->value('avatar_path'))) {
                return;
            }

            $response = Http::timeout(5)->connectTimeout(3)->withoutRedirecting()->get($url);
            $body = $response->successful() ? $response->body() : '';

            if ($body === '' || strlen($body) > self::MAX_BYTES) {
                return;
            }

            $info = @getimagesizefromstring($body);
            $extension = self::TYPES[$info['mime'] ?? ''] ?? null;

            if (! $extension) {
                return;
            }

            $path = 'profile-photos/'.Str::random(40).'.'.$extension;
            Storage::disk('private')->put($path, $body);

            $user->profile()->updateOrCreate(['user_id' => $user->getKey()], ['avatar_path' => $path]);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    /** The address, if it is Google's image CDN over https, asked for 256px. */
    private function safeUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $parts = parse_url($url);
        $host = strtolower((string) ($parts['host'] ?? ''));

        if (($parts['scheme'] ?? '') !== 'https' || ! str_ends_with($host, self::HOST_SUFFIX)) {
            return null;
        }

        // Google serves 96px by default; the profile shows it at 120px.
        return preg_replace('/=s\d+(-c)?$/', '=s256-c', $url) ?? $url;
    }
}
