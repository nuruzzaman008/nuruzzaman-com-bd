<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use SensitiveParameter;

/**
 * The second step of signing in: a code from the authenticator app, or one of
 * the recovery codes for when the phone is not to hand.
 *
 * Each code works once. An app code's time step is stored in the same
 * statement that checks it is newer than the last one, so a code read over
 * someone's shoulder, or two requests racing with one code, gets in at most
 * once. A recovery code is removed as it is used.
 *
 * Recovery codes are kept only as SHA-256 hashes - the approach Sanctum takes
 * with its tokens. Each code is 80 random bits, so a hash cannot be walked
 * back to its code even by someone holding the database, and a slow password
 * hash would buy nothing but a slower sign-in.
 */
final class TwoFactor
{
    public const RECOVERY_CODE_COUNT = 8;

    /** 32 letters and digits, without the ones that read alike (0/O, 1/I). */
    private const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    /** 16 characters of 5 bits each: 80 bits. */
    private const RECOVERY_LENGTH = 16;

    /** Checks an app code and uses it up. */
    public static function consumeCode(User $user, #[SensitiveParameter] string $code): bool
    {
        $secret = (string) $user->mfa_secret;

        if ($secret === '') {
            return false;
        }

        $step = Totp::match($secret, $code, $user->mfa_last_used_step);

        if ($step === null) {
            return false;
        }

        $claimed = User::query()
            ->whereKey($user->getKey())
            ->where(fn ($query) => $query
                ->whereNull('mfa_last_used_step')
                ->orWhere('mfa_last_used_step', '<', $step))
            ->toBase()
            ->update(['mfa_last_used_step' => $step]);

        if ($claimed !== 1) {
            return false;
        }

        $user->forceFill(['mfa_last_used_step' => $step])->syncOriginalAttribute('mfa_last_used_step');

        return true;
    }

    /** Checks a recovery code and removes it, so it cannot be used again. */
    public static function consumeRecoveryCode(User $user, #[SensitiveParameter] string $code): bool
    {
        $hash = self::hash($code);

        if ($hash === null) {
            return false;
        }

        return DB::transaction(function () use ($user, $hash): bool {
            /** @var User|null $locked */
            $locked = User::query()->whereKey($user->getKey())->lockForUpdate()->first();
            $remaining = [];
            $found = false;

            foreach ($locked?->mfa_recovery_codes ?? [] as $candidate) {
                if (! $found && hash_equals((string) $candidate, $hash)) {
                    $found = true;

                    continue;
                }

                $remaining[] = $candidate;
            }

            if (! $found) {
                return false;
            }

            $locked->forceFill(['mfa_recovery_codes' => $remaining])->save();
            $user->forceFill(['mfa_recovery_codes' => $remaining])->syncOriginalAttribute('mfa_recovery_codes');

            return true;
        });
    }

    /**
     * Whichever of the two the form sent. Returns how the person got through
     * ('app' or 'recovery_code') for the audit log, or null if they did not.
     */
    public static function attempt(
        User $user,
        #[SensitiveParameter] ?string $code,
        #[SensitiveParameter] ?string $recoveryCode,
    ): ?string {
        if (filled($code)) {
            return self::consumeCode($user, (string) $code) ? 'app' : null;
        }

        if (filled($recoveryCode)) {
            return self::consumeRecoveryCode($user, (string) $recoveryCode) ? 'recovery_code' : null;
        }

        return null;
    }

    /**
     * A fresh set, replacing any earlier one. The plain codes are returned to
     * be shown once and are not kept anywhere.
     *
     * @return list<string>
     */
    public static function generateRecoveryCodes(User $user): array
    {
        $codes = [];

        for ($i = 0; $i < self::RECOVERY_CODE_COUNT; $i++) {
            $code = '';

            for ($c = 0; $c < self::RECOVERY_LENGTH; $c++) {
                $code .= self::RECOVERY_ALPHABET[random_int(0, strlen(self::RECOVERY_ALPHABET) - 1)];
            }

            // ABCD-EFGH-JKLM-NPQR: easier to copy by hand than sixteen in a row.
            $codes[] = implode('-', str_split($code, 4));
        }

        $user->forceFill([
            'mfa_recovery_codes' => array_map(fn (string $code) => self::hash($code), $codes),
        ])->save();

        return $codes;
    }

    public static function remainingRecoveryCodes(User $user): int
    {
        return count($user->mfa_recovery_codes ?? []);
    }

    /** Everything two-step verification stored for this account, gone. */
    public static function clear(User $user): void
    {
        $user->forceFill([
            'mfa_secret' => null,
            'mfa_confirmed_at' => null,
            'mfa_recovery_codes' => null,
            'mfa_last_used_step' => null,
        ])->save();
    }

    /**
     * Case, spaces and dashes do not matter, so "abcd efgh ..." typed from a
     * printout still matches.
     */
    private static function hash(#[SensitiveParameter] string $code): ?string
    {
        $normalized = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code) ?? '');

        return $normalized === '' ? null : hash('sha256', $normalized);
    }
}
