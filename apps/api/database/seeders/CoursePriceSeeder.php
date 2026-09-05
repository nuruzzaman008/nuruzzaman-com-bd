<?php

namespace Database\Seeders;

use App\Enums\ContentStatus;
use App\Enums\ProductType;
use App\Models\Course;
use App\Models\Price;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * The owner's course prices.
 *
 * Unlike DemoSeeder this is allowed to run in production, because these are
 * real prices the owner chose rather than walkthrough placeholders. The owner
 * gave the range - BDT 5,000 to 10,000 - and the tier below assigns a figure
 * inside it from each course's own level, so every number can be explained and
 * any single one can be changed in the admin afterwards.
 *
 * No `compare_at_minor` is written. A struck-through "was" price has to be one
 * the course was genuinely sold at; inventing one would be an invented
 * discount, and the owner has not said these courses were ever sold higher.
 */
class CoursePriceSeeder extends Seeder
{
    /** Price in minor units (poisha), by course level. */
    private const TIERS = [
        'beginner' => 500000,
        'intermediate' => 750000,
        'advanced' => 1000000,
    ];

    /** What an unlevelled course gets: the middle of the owner's range. */
    private const DEFAULT_TIER = 750000;

    public function run(): void
    {
        $courses = Course::query()->orderBy('id')->get();

        if ($courses->isEmpty()) {
            $this->command?->warn('No courses found; nothing to price.');

            return;
        }

        foreach ($courses as $course) {
            $amount = self::TIERS[$course->level] ?? self::DEFAULT_TIER;

            /*
             * A course is sold through the catalogue like anything else, so it
             * needs a product and a variant to hang the price on. Matched on
             * the slug, so running this again re-prices rather than duplicates.
             */
            $product = Product::query()->updateOrCreate(
                ['slug' => 'course-'.$course->slug],
                [
                    'type' => ProductType::Course,
                    'name' => $course->title,
                    'name_en' => $course->title_en,
                    'tagline' => $course->subtitle,
                    'tagline_en' => $course->subtitle_en,
                    'status' => ContentStatus::Published,
                    'is_price_public' => true,
                    'published_at' => now(),
                ],
            );

            $variant = $product->variants()->updateOrCreate(
                ['sku' => 'CRS-'.Str::upper(Str::substr(md5($course->slug), 0, 8))],
                [
                    'name' => 'একক শিক্ষার্থী',
                    'course_id' => $course->getKey(),
                    'access_duration_days' => 365,
                    'is_active' => true,
                    'position' => 0,
                ],
            );

            Price::query()->updateOrCreate(
                ['product_variant_id' => $variant->getKey(), 'currency' => 'BDT'],
                ['amount_minor' => $amount, 'is_active' => true],
            );

            $this->command?->line(sprintf(
                '  %-45s %-12s BDT %s',
                $course->slug,
                $course->level ?? '-',
                number_format($amount / 100),
            ));
        }

        $this->command?->info('Priced '.$courses->count().' course(s).');
    }
}
