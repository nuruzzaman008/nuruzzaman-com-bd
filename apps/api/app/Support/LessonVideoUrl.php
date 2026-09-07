<?php

namespace App\Support;

class LessonVideoUrl
{
    /** Normalize known players; other HTTPS links open on their provider website. */
    public static function descriptor(string $url): ?array
    {
        $parts = parse_url($url);
        if (! $parts || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }
        $host = strtolower($parts['host']);
        $path = $parts['path'] ?? '';
        parse_str($parts['query'] ?? '', $query);
        $provider = 'external';
        $kind = 'link';
        if (in_array($host, ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'], true)) {
            $id = $host === 'youtu.be' ? trim($path, '/') : ($query['v'] ?? null);
            if (preg_match('~^/(?:embed|shorts|live)/([a-zA-Z0-9_-]{11})/?$~', $path, $match)) {
                $id = $match[1];
            }
            if (! is_string($id) || ! preg_match('/^[a-zA-Z0-9_-]{11}$/', $id)) {
                return null;
            }
            $url = 'https://www.youtube-nocookie.com/embed/'.$id;
            $provider = 'youtube';
            $kind = 'iframe';
        } elseif (in_array($host, ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'], true)) {
            if (! preg_match('~^/(?:video/)?(\d+)(?:/([a-zA-Z0-9]+))?/?$~', $path, $match)) {
                return null;
            }
            $url = 'https://player.vimeo.com/video/'.$match[1];
            $hash = $match[2] ?? ($query['h'] ?? null);
            if (is_string($hash) && preg_match('/^[a-zA-Z0-9]+$/', $hash)) {
                $url .= '?h='.$hash;
            }
            $provider = 'vimeo';
            $kind = 'iframe';
        } elseif (preg_match('/\.(mp4|webm|ogv)$/i', $path)) {
            $provider = 'direct';
            $kind = 'video';
        }
        return ['provider' => $provider, 'kind' => $kind, 'url' => $url, 'available' => true, 'token' => null, 'expires_in' => 0, 'message' => null];
    }
}
