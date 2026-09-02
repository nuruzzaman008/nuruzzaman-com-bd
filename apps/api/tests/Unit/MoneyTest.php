<?php

namespace Tests\Unit;

use App\Support\Money;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    public function test_it_adds_and_subtracts_in_minor_units(): void
    {
        $a = Money::minor(150000);
        $b = Money::minor(49999);

        $this->assertSame(199999, $a->plus($b)->minor);
        $this->assertSame(100001, $a->minus($b)->minor);
    }

    public function test_subtraction_never_goes_negative(): void
    {
        $this->assertSame(0, Money::minor(100)->minus(Money::minor(500))->minor);
    }

    public function test_percentage_rounds_half_up_on_the_minor_unit(): void
    {
        // 10% of 1005 poisha is 100.5 -> 101, never 100.4999 as a float.
        $this->assertSame(101, Money::minor(1005)->percentage(10)->minor);
        $this->assertSame(0, Money::minor(1005)->percentage(0)->minor);
        $this->assertSame(1005, Money::minor(1005)->percentage(100)->minor);
    }

    public function test_major_string_is_two_decimal_places(): void
    {
        $this->assertSame('5000.00', Money::minor(500000)->toMajorString());
        $this->assertSame('0.07', Money::minor(7)->toMajorString());
    }

    public function test_currencies_cannot_be_mixed(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Money::minor(100, 'BDT')->plus(Money::minor(100, 'USD'));
    }
}
