<?php

namespace App\Support;

/**
 * The course catalogue's subject tracks.
 *
 * Kept as a small fixed list rather than a table: a track is a navigation
 * bucket, not editorial content, and the front end keys its generated cover
 * artwork off these exact slugs.
 */
class CourseTracks
{
    public const ALL = [
        'foundation-geotechnical' => 'ফাউন্ডেশন ও জিওটেকনিক্যাল',
        'rcc-design-detailing' => 'RCC ডিজাইন ও ডিটেইলিং',
        'structural-engineering' => 'স্ট্রাকচারাল অ্যানালাইসিস',
        'steel-design' => 'স্টিল স্ট্রাকচার ডিজাইন',
        'autocad-productivity' => 'AutoCAD ও ড্রাফটিং',
        'engineering-software' => 'ইঞ্জিনিয়ারিং সফটওয়্যার',
        'bnbc-code-application' => 'BNBC ও কোড প্রয়োগ',
        'construction-quality' => 'নির্মাণ মান ও সাইট প্র্যাকটিস',
        'quantity-estimation' => 'কোয়ান্টিটি ও এস্টিমেট',
        'mouza-drawing-workflow' => 'মৌজা ম্যাপ ও ল্যান্ড ড্রয়িং',
    ];

    public static function name(?string $slug): ?string
    {
        return self::ALL[$slug] ?? null;
    }

    public static function exists(?string $slug): bool
    {
        return $slug !== null && array_key_exists($slug, self::ALL);
    }

    public static function slugs(): array
    {
        return array_keys(self::ALL);
    }
}
