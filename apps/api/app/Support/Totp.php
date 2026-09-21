<?php

namespace App\Support;

use SensitiveParameter;

/**
 * Time-based one-time passwords (RFC 6238), as every authenticator app makes
 * them: SHA-1, six digits, a new one every thirty seconds.
 *
 * Written out rather than pulled in, because it is thirty lines of hashing and
 * one more dependency on a shared host is one more thing to keep patched. The
 * secret never leaves the server except once, when it is shown to the person
 * setting the app up.
 */
final class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    private const DIGITS = 6;

    private const PERIOD = 30;

    /** A step either side, so a clock a few seconds out still works. */
    private const WINDOW = 1;

    /** 160 bits, the size RFC 4226 recommends for a SHA-1 secret. */
    public static function generateSecret(): string
    {
        return self::base32Encode(random_bytes(20));
    }

    /**
     * Constant-time check of a code against the secret, over the window.
     * Codes are compared as strings, so "012345" is not read as 12345.
     */
    public static function verify(#[SensitiveParameter] string $secret, string $code, ?int $at = null): bool
    {
        $code = preg_replace('/\D/', '', $code) ?? '';

        if (strlen($code) !== self::DIGITS) {
            return false;
        }

        $counter = intdiv($at ?? time(), self::PERIOD);
        $valid = false;

        for ($step = -self::WINDOW; $step <= self::WINDOW; $step++) {
            // No early return: every candidate is compared, so the time taken
            // says nothing about which step matched.
            $valid = hash_equals(self::at($secret, $counter + $step), $code) || $valid;
        }

        return $valid;
    }

    /** The code for one counter value, zero-padded to six digits. */
    public static function at(#[SensitiveParameter] string $secret, int $counter): string
    {
        $key = self::base32Decode($secret);

        if ($key === '') {
            return str_repeat('0', self::DIGITS);
        }

        $hash = hash_hmac('sha1', pack('J', $counter), $key, true);
        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;
        $binary = ((ord($hash[$offset]) & 0x7F) << 24)
            | ((ord($hash[$offset + 1]) & 0xFF) << 16)
            | ((ord($hash[$offset + 2]) & 0xFF) << 8)
            | (ord($hash[$offset + 3]) & 0xFF);

        return str_pad((string) ($binary % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    /** The otpauth:// URI an authenticator app reads from a QR code. */
    public static function uri(#[SensitiveParameter] string $secret, string $account, string $issuer): string
    {
        return 'otpauth://totp/'.rawurlencode($issuer).':'.rawurlencode($account).'?'.http_build_query([
            'secret' => $secret,
            'issuer' => $issuer,
            'algorithm' => 'SHA1',
            'digits' => self::DIGITS,
            'period' => self::PERIOD,
        ]);
    }

    public static function base32Encode(string $bytes): string
    {
        $bits = '';

        foreach (str_split($bytes) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $encoded = '';

        foreach (str_split($bits, 5) as $chunk) {
            $encoded .= self::ALPHABET[bindec(str_pad($chunk, 5, '0', STR_PAD_RIGHT))];
        }

        return $encoded;
    }

    public static function base32Decode(#[SensitiveParameter] string $secret): string
    {
        $bits = '';

        foreach (str_split(strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $secret) ?? '')) as $character) {
            $index = strpos(self::ALPHABET, $character);

            if ($index === false) {
                return '';
            }

            $bits .= str_pad(decbin($index), 5, '0', STR_PAD_LEFT);
        }

        $bytes = '';

        foreach (str_split($bits, 8) as $chunk) {
            if (strlen($chunk) === 8) {
                $bytes .= chr(bindec($chunk));
            }
        }

        return $bytes;
    }
}
