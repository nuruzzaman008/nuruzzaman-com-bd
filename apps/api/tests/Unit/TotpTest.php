<?php

namespace Tests\Unit;

use App\Support\Totp;
use PHPUnit\Framework\TestCase;

/**
 * The settings around pragmarx/google2fa, checked against RFC 6238's own
 * examples: the SHA-1 secret "12345678901234567890", whose six-digit codes are
 * the last six digits of the RFC's eight-digit ones.
 */
class TotpTest extends TestCase
{
    private const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    public function test_codes_match_the_rfc_6238_examples(): void
    {
        foreach ([59 => '287082', 1111111109 => '081804', 1234567890 => '005924', 2000000000 => '279037'] as $time => $code) {
            $this->assertSame($code, Totp::at(self::RFC_SECRET, intdiv($time, Totp::PERIOD)), "t=$time");
        }
    }

    public function test_a_code_is_accepted_a_step_either_side_and_not_further(): void
    {
        $secret = Totp::generateSecret();
        $now = Totp::currentStep();

        $this->assertNotNull(Totp::match($secret, Totp::at($secret, $now)));
        $this->assertNotNull(Totp::match($secret, Totp::at($secret, $now - 1)));
        $this->assertNotNull(Totp::match($secret, Totp::at($secret, $now + 1)));
        $this->assertNull(Totp::match($secret, Totp::at($secret, $now - 3)));
    }

    public function test_a_code_at_or_before_the_last_used_step_is_refused(): void
    {
        $secret = Totp::generateSecret();
        $now = Totp::currentStep();
        $code = Totp::at($secret, $now);

        $this->assertSame($now, Totp::match($secret, $code));
        $this->assertNull(Totp::match($secret, $code, $now));
        $this->assertSame($now + 1, Totp::match($secret, Totp::at($secret, $now + 1), $now));
    }

    public function test_malformed_input_verifies_nothing(): void
    {
        $secret = Totp::generateSecret();

        $this->assertNull(Totp::match($secret, '12345'));
        $this->assertNull(Totp::match($secret, 'abcdef'));
        $this->assertNull(Totp::match('not a secret!', '123456'));
        // Spaces the way some apps display a code are fine.
        $code = Totp::at($secret, Totp::currentStep());
        $this->assertNotNull(Totp::match($secret, substr($code, 0, 3).' '.substr($code, 3)));
    }

    public function test_secrets_are_160_bits_of_base32(): void
    {
        $secret = Totp::generateSecret();

        $this->assertMatchesRegularExpression('/^[A-Z2-7]{32}$/', $secret);
        $this->assertNotSame($secret, Totp::generateSecret());
    }
}
