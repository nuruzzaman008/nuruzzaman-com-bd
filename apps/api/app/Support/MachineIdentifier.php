<?php

namespace App\Support;

/**
 * A customer Machine ID is personal hardware data. It is stored encrypted, is
 * looked up by keyed hash, and is only ever rendered in masked form.
 */
final class MachineIdentifier
{
    public static function normalize(string $machineId): string
    {
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $machineId) ?? '');
    }

    public static function fingerprint(string $machineId): string
    {
        return hash_hmac('sha256', self::normalize($machineId), (string) config('app.key'));
    }

    /** Keeps only the first and last four characters, e.g. `A1B2...9F3C`. */
    public static function mask(string $machineId): string
    {
        $normalized = self::normalize($machineId);
        $length = strlen($normalized);

        if ($length <= 8) {
            return str_repeat('*', max(0, $length));
        }

        return substr($normalized, 0, 4).str_repeat('*', min(8, $length - 8)).substr($normalized, -4);
    }
}
