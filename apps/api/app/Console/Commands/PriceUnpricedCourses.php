<?php

namespace App\Console\Commands;

use App\Models\Course;
use App\Services\Lms\CoursePricingService;
use Illuminate\Console\Command;

class PriceUnpricedCourses extends Command
{
    protected $signature = 'courses:price-unpriced {--bdt=1500 : Price in whole BDT}';

    protected $description = 'Add a price only to courses without an effective price; preserve existing prices.';

    public function handle(CoursePricingService $pricing): int
    {
        $amount = filter_var($this->option('bdt'), FILTER_VALIDATE_INT);
        if ($amount === false || $amount < 1 || $amount > 1000000) {
            $this->error('BDT must be 1–1000000.');

            return self::FAILURE;
        }
        $count = 0;
        foreach (Course::with('purchasableVariants.prices')->get() as $course) {
            if ($course->purchasableVariants->contains(fn ($variant) => $variant->currentPrice() !== null)) {
                continue;
            }
            $pricing->set($course, $amount * 100);
            $count++;
        }
        $this->info("Priced {$count} courses at BDT {$amount}; existing prices preserved.");

        return self::SUCCESS;
    }
}
