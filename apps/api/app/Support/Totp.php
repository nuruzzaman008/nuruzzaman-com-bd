<?php

namespace App\Support;

use PragmaRX\Google2FA\Exceptions\Contracts\Google2FA as Google2FAException;
use PragmaRX\Google2FA\Google2FA;
use SensitiveParameter;

/**
 * Time-based one-time passwords (RFC 6238), as Google Authenticator and every
 * other authenticator app make them: SHA-1, six digits, a new one every thirty
 * seconds.
 *
 * The arithmetic is pragmarx/google2fa's, the library Laravel Fortify uses;
 * this class only fixes the settings in one place and answers in the terms the
 * rest of the application needs. The secret never leaves the server except
 * once, while the person setting the app up is looking at it.
 */
final class Totp
{
    /** Seconds each code is valid for. */
    public const PERIOD = 30;

    /** A step either side, so a phone clock a few seconds out still works. */
    private const WINDOW = 1;

    /** 32 base32 characters: 160 bits, the size RFC 4226 recommends for SHA-1. */
    private const SECRET_LENGTH = 32;

    private static function engine(): Google2FA
    {
        $engine = new Google2FA;
        $engine->setWindow(self::WINDOW);

        return $engine;
    }

    public static function generateSecret(): string
    {
        return self::engine()->generateSecretKey(self::SECRET_LENGTH);
    }

    /**
     * The time step a code belongs to, when it is right and newer than the
     * last step this account used; null otherwise.
     *
     * Returning the step rather than yes or no is what lets the caller refuse
     * the same code twice: the step is stored, and anything at or before it
     * no longer counts.
     */
    public static function match(
        #[SensitiveParameter] string $secret,
        #[SensitiveParameter] string $code,
        ?int $lastUsedStep = null,
    ): ?int {
        $code = preg_replace('/\s+/', '', $code) ?? '';

        if (! preg_match('/^\d{6}$/', $code)) {
            return null;
        }

        try {
            $step = self::engine()->verifyKeyNewer($secret, $code, $lastUsedStep ?? 0);
        } catch (Google2FAException) {
            // A stored secret the library cannot read verifies nothing.
            return null;
        }

        return is_int($step) ? $step : null;
    }

    /** The code for one time step. Tests use it to act as the phone. */
    public static function at(#[SensitiveParameter] string $secret, int $step): string
    {
        return self::engine()->oathTotp($secret, $step);
    }

    public static function currentStep(): int
    {
        return intdiv(time(), self::PERIOD);
    }

    /** The otpauth:// address the QR code carries: issuer, account and secret. */
    public static function uri(#[SensitiveParameter] string $secret, string $account, string $issuer): string
    {
        return self::engine()->getQRCodeUrl($issuer, $account, $secret);
    }
}
