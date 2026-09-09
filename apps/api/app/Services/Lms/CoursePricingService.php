<?php

namespace App\Services\Lms;

use App\Models\Course;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Content\RevalidationService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;

class CoursePricingService
{
    public function set(Course $course, int $amountMinor): void
    {
        DB::transaction(function () use ($course, $amountMinor) {
            Course::whereKey($course->id)->lockForUpdate()->firstOrFail();
            $variant = ProductVariant::where('course_id', $course->id)->where('is_active', true)->orderBy('id')->first();
            if (! $variant) {
                $product = Product::firstOrCreate(['slug' => 'course-access-'.$course->id], ['type' => 'course', 'name' => $course->title, 'status' => $course->status, 'is_price_public' => true, 'published_at' => $course->published_at]);
                $variant = $product->variants()->firstOrCreate(['sku' => 'COURSE-ACCESS-'.$course->id], ['name' => 'Full video course access', 'course_id' => $course->id, 'is_active' => true]);
            }
            $variant->product->update(['is_price_public' => true]);
            if ($variant->currentPrice()?->amount_minor === $amountMinor && $variant->currentPrice()?->currency === 'BDT') {
                return;
            }
            $variant->prices()->where('currency', 'BDT')->where('is_active', true)->update(['is_active' => false, 'ends_at' => now()]);
            $variant->prices()->create(['currency' => 'BDT', 'amount_minor' => $amountMinor, 'is_active' => true, 'starts_at' => now()]);
        });
        DB::afterCommit(function () use ($course) {
            try {
                app(RevalidationService::class)->revalidate(['courses', 'course:'.$course->slug, 'products']);
            } catch (ConnectionException $error) {
                report($error);
            }
        });
    }
}
