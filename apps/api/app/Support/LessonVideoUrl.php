<?php

namespace App\Support;

class LessonVideoUrl
{
    private const FACEBOOK_HOSTS = ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'fb.watch'];

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
        } elseif (in_array($host, self::FACEBOOK_HOSTS, true)) {
            $href = self::facebookVideo($host, $path, $query);
            if ($href === null) {
                return null;
            }
            // Facebook's own embeddable player. The video has to be public on
            // Facebook for it to play here.
            $url = 'https://www.facebook.com/plugins/video.php?'.http_build_query([
                'href' => $href,
                'show_text' => 'false',
                'width' => 1280,
            ]);
            $provider = 'facebook';
            $kind = 'iframe';
        } elseif (preg_match('/\.(mp4|webm|ogv)$/i', $path)) {
            $provider = 'direct';
            $kind = 'video';
        }
        return ['provider' => $provider, 'kind' => $kind, 'url' => $url, 'available' => true, 'token' => null, 'expires_in' => 0, 'message' => null];
    }

    /**
     * The canonical address of a Facebook video, rebuilt from the parts that
     * identify it, or null when the link is not to a video (a page, a profile).
     *
     * @param  array<string, mixed>  $query
     */
    private static function facebookVideo(string $host, string $path, array $query): ?string
    {
        if ($host === 'fb.watch') {
            return preg_match('~^/([A-Za-z0-9_-]+)/?$~', $path, $match) ? 'https://fb.watch/'.$match[1].'/' : null;
        }

        // /watch/?v=123 and the older /video.php?v=123
        if (preg_match('~^/(?:watch|video\.php)/?$~', $path)) {
            $id = $query['v'] ?? null;

            return is_string($id) && preg_match('/^\d+$/', $id) ? 'https://www.facebook.com/watch/?v='.$id : null;
        }

        // /{page}/videos/{id}, /{page}/videos/{title}/{id}, /reel/{id}, /share/v/{code}
        if (preg_match('~^/(?:[A-Za-z0-9._%-]+/videos/(?:[A-Za-z0-9._%-]+/)?\d+|reel/\d+|share/[vr]/[A-Za-z0-9]+)/?$~', $path)) {
            return 'https://www.facebook.com'.rtrim($path, '/').'/';
        }

        return null;
    }
}
