<?php

namespace App\Support;

use Illuminate\Support\Str;

/** Human-readable, non-sequential public references for orders and requests. */
final class Reference
{
    public static function order(): string
    {
        return 'NZ-'.now()->format('ymd').'-'.strtoupper(Str::random(6));
    }

    public static function payment(): string
    {
        return 'PAY-'.now()->format('ymdHis').'-'.strtoupper(Str::random(6));
    }

    public static function invoice(): string
    {
        return 'INV-'.now()->format('ymd').'-'.strtoupper(Str::random(6));
    }

    public static function activation(): string
    {
        return 'ACT-'.now()->format('ymd').'-'.strtoupper(Str::random(6));
    }

    public static function refill(): string
    {
        return 'RFL-'.now()->format('ymd').'-'.strtoupper(Str::random(6));
    }

    public static function ticket(): string
    {
        return 'SUP-'.now()->format('ymd').'-'.strtoupper(Str::random(6));
    }

    public static function license(): string
    {
        return 'NBET-'.strtoupper(Str::random(4)).'-'.strtoupper(Str::random(4)).'-'.strtoupper(Str::random(4));
    }

    public static function certificate(): string
    {
        return 'CERT-'.now()->format('Y').'-'.strtoupper(Str::random(8));
    }
}
