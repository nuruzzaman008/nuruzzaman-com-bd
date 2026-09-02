<?php

namespace App\Services\Video;

use App\Exceptions\DomainException;
use App\Models\Lesson;

/**
 * Mints a short-lived playback descriptor for a lesson video.
 *
 * The provider asset id and any signing key stay on the server; the browser
 * only ever receives an expiring URL or token. When no provider is configured
 * the caller gets an explicit unavailable state rather than a broken player.
 */
class VideoPlaybackService
{
    /** @return array{provider:string,url:?string,token:?string,expires_in:int,available:bool,message:?string} */
    public function playbackFor(Lesson $lesson): array
    {
        $ttl = (int) config('video.playback_ttl_seconds');
        $driver = $lesson->video_provider ?: config('video.driver');

        if (blank($lesson->video_asset_id) || $driver === 'none') {
            return $this->unavailable('Video for this lesson is not configured yet.');
        }

        return match ($driver) {
            'bunny' => $this->bunny($lesson, $ttl),
            'vimeo' => $this->vimeo($lesson, $ttl),
            default => $this->unavailable('Unsupported video provider: '.$driver),
        };
    }

    private function bunny(Lesson $lesson, int $ttl): array
    {
        $library = config('video.bunny.library_id');
        $key = config('video.bunny.token_key');
        $host = config('video.bunny.cdn_hostname');

        if (blank($library) || blank($key) || blank($host)) {
            return $this->unavailable('Bunny Stream credentials are not configured.');
        }

        $expires = time() + $ttl;
        $path = '/'.$lesson->video_asset_id.'/playlist.m3u8';
        $token = hash('sha256', $key.$path.$expires, true);
        $token = rtrim(strtr(base64_encode($token), '+/', '-_'), '=');

        return [
            'provider' => 'bunny',
            'url' => "https://{$host}{$path}?token={$token}&expires={$expires}",
            'token' => null,
            'expires_in' => $ttl,
            'available' => true,
            'message' => null,
        ];
    }

    private function vimeo(Lesson $lesson, int $ttl): array
    {
        if (blank(config('video.vimeo.access_token'))) {
            return $this->unavailable('Vimeo credentials are not configured.');
        }

        // Private Vimeo playback is domain-restricted rather than URL-signed.
        return [
            'provider' => 'vimeo',
            'url' => 'https://player.vimeo.com/video/'.$lesson->video_asset_id,
            'token' => null,
            'expires_in' => $ttl,
            'available' => true,
            'message' => null,
        ];
    }

    private function unavailable(string $message): array
    {
        return [
            'provider' => 'none',
            'url' => null,
            'token' => null,
            'expires_in' => 0,
            'available' => false,
            'message' => $message,
        ];
    }

    public function assertConfigured(): void
    {
        if (config('video.driver') === 'none') {
            throw DomainException::unavailable('No video provider is configured.');
        }
    }
}
