<?php

namespace App\Services\Lms;

use App\Models\Course;
use App\Models\Price;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Content\RevalidationService;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;

/**
 * A course's price: free, a regular price, or a regular price with an offer
 * that ends at a set time.
 *
 * Kept in the price rows every product already uses, so the cart, checkout
 * and the payment gateway read it without knowing offers exist:
 *
 *  - the regular price is an open-ended row;
 *  - an offer is a second row, starting a moment after it, that carries the
 *    regular price as compare_at_minor and ends when the offer does.
 *
 * ProductVariant::currentPrice() picks the latest-starting row in effect, so
 * the offer is what is charged while it runs, and the regular price takes
 * over the moment it ends - nobody has to remember to switch it back.
 *
 * Free is a regular price of zero. Checkout refuses a zero total, so a free
 * course is joined through FreeEnrollmentController rather than the cart.
 */
class CoursePricingService
{
    /** A regular price with no offer. */
    public function set(Course $course, int $amountMinor): void
    {
        $this->plan($course, $amountMinor, null, null);
    }

    /**
     * @param  int  $regularMinor  0 for a free course
     * @param  int|null  $offerMinor  the offer price, below the regular one
     */
    public function plan(Course $course, int $regularMinor, ?int $offerMinor, ?DateTimeInterface $offerEndsAt): void
    {
        // An offer needs both a price and an end; half of one is no offer.
        // Stored to the second, as the database keeps it, so an unchanged
        // offer saved again compares equal instead of restarting.
        $endsAt = $offerMinor !== null && $offerEndsAt !== null && $regularMinor > 0
            ? CarbonImmutable::createFromTimestamp($offerEndsAt->getTimestamp())
            : null;
        $offerMinor = $endsAt ? $offerMinor : null;

        DB::transaction(function () use ($course, $regularMinor, $offerMinor, $endsAt) {
            Course::whereKey($course->id)->lockForUpdate()->firstOrFail();
            $variant = $this->variant($course);
            $variant->product->update(['is_price_public' => true]);

            [$regular, $offer] = $this->rows($variant);

            $sameRegular = $regular?->amount_minor === $regularMinor;
            $sameOffer = $offerMinor === null
                ? $offer === null
                : $offer !== null
                    && $offer->amount_minor === $offerMinor
                    && $offer->compare_at_minor === $regularMinor
                    && $offer->ends_at?->getTimestamp() === $endsAt->getTimestamp();

            if ($sameRegular && $sameOffer) {
                return;
            }

            $now = CarbonImmutable::now()->startOfSecond();
            $active = fn () => $variant->prices()->where('currency', 'BDT')->where('is_active', true);

            // Rows still running end now; rows already over just stop being
            // active, keeping the end they had.
            $active()->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>', $now))
                ->update(['is_active' => false, 'ends_at' => $now]);
            $active()->update(['is_active' => false]);

            $variant->prices()->create([
                'currency' => 'BDT',
                'amount_minor' => $regularMinor,
                'is_active' => true,
                // A second earlier than any offer, so the offer is the later
                // start and wins while it lasts.
                'starts_at' => $now->subSecond(),
            ]);

            if ($offerMinor !== null) {
                $variant->prices()->create([
                    'currency' => 'BDT',
                    'amount_minor' => $offerMinor,
                    'compare_at_minor' => $regularMinor,
                    'is_active' => true,
                    'starts_at' => $now,
                    'ends_at' => $endsAt,
                ]);
            }
        });

        DB::afterCommit(function () use ($course) {
            try {
                app(RevalidationService::class)->revalidate(['courses', 'course:'.$course->slug, 'products']);
            } catch (ConnectionException $error) {
                report($error);
            }
        });
    }

    /**
     * What the course editor shows: the kind of pricing, the regular price,
     * and the offer while it is still running.
     *
     * @return array{type: 'free'|'paid'|'unpriced', regular_minor: ?int, offer_minor: ?int, offer_ends_at: ?string}
     */
    public function summary(Course $course): array
    {
        $variant = ProductVariant::query()
            ->where('course_id', $course->id)
            ->where('is_active', true)
            ->orderBy('id')
            ->first();

        [$regular, $offer] = $variant ? $this->rows($variant) : [null, null];
        $regularMinor = $regular?->amount_minor ?? $offer?->compare_at_minor;

        return [
            'type' => $regularMinor === null ? 'unpriced' : ($regularMinor === 0 ? 'free' : 'paid'),
            'regular_minor' => $regularMinor,
            'offer_minor' => $offer?->amount_minor,
            'offer_ends_at' => $offer?->ends_at?->toIso8601String(),
        ];
    }

    private function variant(Course $course): ProductVariant
    {
        $variant = ProductVariant::where('course_id', $course->id)->where('is_active', true)->orderBy('id')->first();

        if ($variant) {
            return $variant;
        }

        $product = Product::firstOrCreate(['slug' => 'course-access-'.$course->id], ['type' => 'course', 'name' => $course->title, 'status' => $course->status, 'is_price_public' => true, 'published_at' => $course->published_at]);

        return $product->variants()->firstOrCreate(['sku' => 'COURSE-ACCESS-'.$course->id], ['name' => 'Full video course access', 'course_id' => $course->id, 'is_active' => true]);
    }

    /**
     * The regular price and the running offer, each null when there is none.
     *
     * @return array{0: ?Price, 1: ?Price}
     */
    private function rows(ProductVariant $variant): array
    {
        $prices = $variant->prices()
            ->where('currency', 'BDT')
            ->where('is_active', true)
            ->get()
            ->filter(fn (Price $price) => $price->isEffective());

        // An offer is a row with an end and a higher price to compare with; a
        // plain row that happens to have an end is still the regular price.
        $isOffer = fn (Price $price) => $price->ends_at !== null && $price->compare_at_minor !== null;

        return [
            $prices->reject($isOffer)->sortByDesc('starts_at')->first(),
            $prices->filter($isOffer)->sortByDesc('starts_at')->first(),
        ];
    }
}
