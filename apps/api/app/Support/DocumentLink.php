<?php

namespace App\Support;

/**
 * A document a lesson links to instead of storing: a Google Drive, Dropbox or
 * OneDrive share, or any other HTTPS address.
 *
 * Kept in lesson_assets.storage_path, so a link can be no longer than that
 * column. Only full https:// addresses without embedded credentials are
 * accepted; anything a browser could run (javascript:, data:) never is.
 */
final class DocumentLink
{
    public const MAX_LENGTH = 512;

    /** @return array{url: string, provider: string}|null */
    public static function normalize(string $url): ?array
    {
        $url = trim($url);

        if ($url === '' || strlen($url) > self::MAX_LENGTH || preg_match('/\s/', $url)) {
            return null;
        }

        $parts = parse_url($url);

        if (! $parts
            || strtolower($parts['scheme'] ?? '') !== 'https'
            || empty($parts['host'])
            || isset($parts['user'])
            || isset($parts['pass'])) {
            return null;
        }

        $host = strtolower($parts['host']);
        $provider = self::providerForHost($host);

        // A Dropbox share link opens a preview page; dl=1 downloads the file.
        if ($provider === 'dropbox' && $host !== 'dl.dropboxusercontent.com') {
            parse_str($parts['query'] ?? '', $query);
            $query['dl'] = '1';
            $url = 'https://'.$host.($parts['path'] ?? '/').'?'.http_build_query($query)
                .(isset($parts['fragment']) ? '#'.$parts['fragment'] : '');
        }

        return strlen($url) <= self::MAX_LENGTH ? ['url' => $url, 'provider' => $provider] : null;
    }

    /** google_drive, dropbox, onedrive or other. */
    public static function provider(string $url): string
    {
        return self::providerForHost(strtolower((string) parse_url($url, PHP_URL_HOST)));
    }

    private static function providerForHost(string $host): string
    {
        $on = fn (array $domains): bool => collect($domains)
            ->contains(fn (string $domain) => $host === $domain || str_ends_with($host, '.'.$domain));

        return match (true) {
            $on(['drive.google.com', 'docs.google.com']) => 'google_drive',
            $on(['dropbox.com', 'dropboxusercontent.com']) => 'dropbox',
            $on(['onedrive.live.com', '1drv.ms', 'sharepoint.com']) => 'onedrive',
            default => 'other',
        };
    }
}
