<?php

namespace App\Services\Affiliates;

use App\Exceptions\DomainException;
use App\Models\Affiliate;
use App\Models\AffiliateVisit;
use App\Models\Setting;
use App\Models\User;
use App\Support\Audit;
use Closure;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * The rules of the affiliate program: its settings, who may join, what a
 * referral code may look like, and which visits and orders a code is credited
 * with. The money side - commissions, balances, payouts - is AffiliateLedger.
 */
class AffiliateProgram
{
    /** Used until the owner saves their own values in the dashboard. */
    public const DEFAULTS = [
        'enabled' => true,
        'default_rate' => 10,
        'cookie_days' => 30,
        'hold_days' => 7,
        'min_payout_minor' => 50000,
    ];

    public const PAYOUT_METHODS = ['bkash', 'nagad', 'rocket', 'bank', 'other'];

    /** Lowercase English letters, digits and inner hyphens; 3 to 32 characters. */
    public const CODE_PATTERN = '/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/';

    /** Codes that would read as the site itself speaking. */
    private const RESERVED = [
        'account', 'admin', 'administrator', 'api', 'dashboard', 'login', 'nb', 'nbconsultant',
        'nuruzzaman', 'null', 'official', 'staff', 'support', 'test',
    ];

    /** @return array{enabled: bool, default_rate: float, cookie_days: int, hold_days: int, min_payout_minor: int} */
    public function settings(): array
    {
        $stored = Setting::query()->where('key', 'like', 'affiliate.%')->pluck('value', 'key');
        $value = fn (string $name): mixed => $stored['affiliate.'.$name] ?? self::DEFAULTS[$name];

        return [
            'enabled' => (bool) $value('enabled'),
            'default_rate' => round((float) $value('default_rate'), 2),
            'cookie_days' => (int) $value('cookie_days'),
            'hold_days' => (int) $value('hold_days'),
            'min_payout_minor' => (int) $value('min_payout_minor'),
        ];
    }

    /** @param  array<string, mixed>  $values */
    public function saveSettings(array $values, ?User $actor = null): array
    {
        $values = array_intersect_key($values, self::DEFAULTS);

        foreach ($values as $name => $value) {
            Setting::query()->updateOrCreate(
                ['key' => 'affiliate.'.$name],
                ['group' => 'affiliate', 'value' => $value, 'is_public' => false],
            );
        }

        Audit::record('affiliate.settings_updated', null, $values, $actor?->getKey());

        return $this->settings();
    }

    /** The affiliate's own rate if the owner set one, otherwise the program's. */
    public function rateFor(Affiliate $affiliate, ?float $defaultRate = null): float
    {
        if ($affiliate->commission_rate !== null) {
            return round((float) $affiliate->commission_rate, 2);
        }

        return $defaultRate ?? $this->settings()['default_rate'];
    }

    /** Codes are compared lowercase, so "Karim-Civil" and "karim-civil" are one code. */
    public function normalizeCode(mixed $code): mixed
    {
        return is_string($code) ? Str::lower(trim($code)) : $code;
    }

    /** @return array<int, mixed> */
    public function codeRules(?int $ignoreAffiliateId): array
    {
        return [
            'string',
            'min:3',
            'max:32',
            'regex:'.self::CODE_PATTERN,
            Rule::unique('affiliates', 'code')->ignore($ignoreAffiliateId),
            function (string $attribute, mixed $value, Closure $fail): void {
                if (in_array($value, self::RESERVED, true)) {
                    $fail('This code is reserved. Please choose another one.');
                }
            },
        ];
    }

    /** @return array<string, string> */
    public function codeMessages(): array
    {
        return [
            'code.regex' => 'Use English letters, digits or hyphens only, starting and ending with a letter or digit.',
            'code.unique' => 'Someone already uses this code. Please choose another one.',
        ];
    }

    /** Joins a customer to the program. Joining twice returns the same membership. */
    public function join(User $user, ?string $code = null): Affiliate
    {
        $existing = Affiliate::query()->where('user_id', $user->getKey())->first();

        if ($existing) {
            return $existing;
        }

        if (! $this->settings()['enabled']) {
            throw DomainException::forbidden('The affiliate program is not open right now.');
        }

        $affiliate = Affiliate::create([
            'user_id' => $user->getKey(),
            'code' => $code ?? $this->suggestCode($user),
            'status' => Affiliate::STATUS_ACTIVE,
        ]);

        Audit::record('affiliate.joined', $affiliate, ['code' => $affiliate->code], $user->getKey());

        return $affiliate;
    }

    /** The active affiliate a code belongs to, or null while the program is closed. */
    public function activeByCode(?string $code): ?Affiliate
    {
        $code = $this->normalizeCode($code);

        if (! is_string($code) || ! preg_match(self::CODE_PATTERN, $code) || ! $this->settings()['enabled']) {
            return null;
        }

        return Affiliate::query()
            ->where('code', $code)
            ->where('status', Affiliate::STATUS_ACTIVE)
            ->first();
    }

    /** The affiliate an order is credited to. A customer never refers themselves. */
    public function attributable(?string $code, User $buyer): ?Affiliate
    {
        $affiliate = $this->activeByCode($code);

        return $affiliate && (int) $affiliate->user_id !== (int) $buyer->getKey() ? $affiliate : null;
    }

    /**
     * Counts a visit through a referral link. The same visitor counts once a
     * day, so reloading a page or opening the link twice does not inflate it.
     */
    public function recordVisit(Affiliate $affiliate, string $ip, ?string $userAgent, ?string $path): bool
    {
        $hash = hash_hmac('sha256', $ip.'|'.$userAgent.'|'.now()->toDateString(), (string) config('app.key'));

        $seen = AffiliateVisit::query()
            ->where('affiliate_id', $affiliate->getKey())
            ->where('visitor_hash', $hash)
            ->where('created_at', '>=', now()->startOfDay())
            ->exists();

        if ($seen) {
            return false;
        }

        AffiliateVisit::create([
            'affiliate_id' => $affiliate->getKey(),
            'visitor_hash' => $hash,
            'landing_path' => $path !== null ? Str::limit($path, 250, '') : null,
        ]);

        return true;
    }

    /** A readable starting code from the customer's name, which they can change. */
    private function suggestCode(User $user): string
    {
        $stem = trim(Str::limit(Str::slug((string) $user->name), 20, ''), '-');

        if (strlen($stem) < 3 || in_array($stem, self::RESERVED, true)) {
            $stem = 'nb-partner';
        }

        do {
            $code = $stem.'-'.random_int(100, 9999);
        } while (Affiliate::query()->where('code', $code)->exists());

        return $code;
    }
}
