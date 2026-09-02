<?php

namespace Database\Seeders\Support;

use RuntimeException;

/**
 * Reads the seed content that lives in /content as plain Markdown, so the owner
 * can edit it without touching PHP.
 *
 * Each document starts with a front-matter block of `key: value` lines between
 * two `---` fences, and documents are separated by a line of `@@@`.
 */
final class ContentBundle
{
    /** @return array<int, array{meta: array<string, string>, body: string}> */
    public static function load(string $filename): array
    {
        $path = base_path('../../content/'.$filename);

        if (! is_file($path)) {
            throw new RuntimeException("Seed content file not found: {$filename}");
        }

        $documents = preg_split('/^@@@\s*$/m', (string) file_get_contents($path)) ?: [];

        return array_values(array_filter(array_map(self::parse(...), $documents)));
    }

    /** @return array{meta: array<string, string>, body: string}|null */
    private static function parse(string $document): ?array
    {
        $document = trim($document);

        if ($document === '') {
            return null;
        }

        if (! preg_match('/\A---\s*\n(.*?)\n---\s*\n(.*)\z/s', $document, $matches)) {
            return null;
        }

        $meta = [];

        foreach (preg_split('/\r?\n/', trim($matches[1])) ?: [] as $line) {
            if (! str_contains($line, ':')) {
                continue;
            }

            [$key, $value] = explode(':', $line, 2);
            $meta[trim($key)] = trim($value);
        }

        return ['meta' => $meta, 'body' => trim($matches[2])];
    }

    public static function bool(array $meta, string $key, bool $default = false): bool
    {
        return match (strtolower($meta[$key] ?? '')) {
            'true', '1', 'yes' => true,
            'false', '0', 'no' => false,
            default => $default,
        };
    }

    /** @return array<int, string> */
    public static function list(array $meta, string $key): array
    {
        if (blank($meta[$key] ?? null)) {
            return [];
        }

        return array_values(array_filter(array_map('trim', explode('|', $meta[$key]))));
    }
}
