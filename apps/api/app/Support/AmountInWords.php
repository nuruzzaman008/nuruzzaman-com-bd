<?php

namespace App\Support;

/**
 * An amount written out, the way a receipt prints it:
 * 1510000 paisa -> "Fifteen thousand one hundred taka only".
 *
 * The international scale (thousand, million), as money receipts from
 * Bangladeshi banks and institutions print their "Taka (in words)" line.
 * Plain arithmetic rather than the intl extension, so it reads the same on
 * every server.
 */
final class AmountInWords
{
    private const ONES = [
        'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
    ];

    private const TENS = [
        2 => 'twenty', 3 => 'thirty', 4 => 'forty', 5 => 'fifty',
        6 => 'sixty', 7 => 'seventy', 8 => 'eighty', 9 => 'ninety',
    ];

    private const SCALES = [1_000_000_000 => 'billion', 1_000_000 => 'million', 1_000 => 'thousand'];

    /** From minor units (paisa) to "... taka [and ... paisa] only". */
    public static function taka(int $minor): string
    {
        $minor = abs($minor);
        $words = self::number(intdiv($minor, 100)).' taka';

        if ($minor % 100 > 0) {
            $words .= ' and '.self::number($minor % 100).' paisa';
        }

        return ucfirst($words.' only');
    }

    public static function number(int $number): string
    {
        if ($number === 0) {
            return 'zero';
        }

        $parts = [];

        foreach (self::SCALES as $value => $name) {
            if ($number >= $value) {
                $parts[] = self::number(intdiv($number, $value)).' '.$name;
                $number %= $value;
            }
        }

        if ($number > 0) {
            $parts[] = self::belowThousand($number);
        }

        return implode(' ', $parts);
    }

    private static function belowThousand(int $number): string
    {
        $parts = [];

        if ($number >= 100) {
            $parts[] = self::ONES[intdiv($number, 100)].' hundred';
            $number %= 100;
        }

        if ($number >= 20) {
            $parts[] = self::TENS[intdiv($number, 10)].($number % 10 ? '-'.self::ONES[$number % 10] : '');
        } elseif ($number > 0) {
            $parts[] = self::ONES[$number];
        }

        return implode(' ', $parts);
    }
}
