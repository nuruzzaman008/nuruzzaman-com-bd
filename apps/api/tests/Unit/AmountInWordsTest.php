<?php

namespace Tests\Unit;

use App\Support\AmountInWords;
use PHPUnit\Framework\TestCase;

class AmountInWordsTest extends TestCase
{
    public function test_it_writes_taka_the_way_a_receipt_prints_them(): void
    {
        $this->assertSame('Fifteen thousand one hundred taka only', AmountInWords::taka(1_510_000));
        $this->assertSame('Five hundred taka only', AmountInWords::taka(50_000));
        $this->assertSame('One thousand nine hundred ninety-nine taka only', AmountInWords::taka(199_900));
        $this->assertSame('Zero taka only', AmountInWords::taka(0));
    }

    public function test_paisa_are_written_when_there_are_any(): void
    {
        $this->assertSame('Twelve taka and fifty paisa only', AmountInWords::taka(1_250));
        $this->assertSame('Zero taka and five paisa only', AmountInWords::taka(5));
    }

    public function test_large_amounts_use_the_international_scale(): void
    {
        $this->assertSame('one million two hundred thirty-four thousand five hundred sixty-seven', AmountInWords::number(1_234_567));
        $this->assertSame('two billion one', AmountInWords::number(2_000_000_001));
        $this->assertSame('one hundred thousand', AmountInWords::number(100_000));
        $this->assertSame('eleven', AmountInWords::number(11));
        $this->assertSame('forty', AmountInWords::number(40));
    }
}
