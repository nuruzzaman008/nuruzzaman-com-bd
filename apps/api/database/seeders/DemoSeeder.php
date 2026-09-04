<?php

namespace Database\Seeders;

use App\Enums\ContentStatus;
use App\Enums\OrderStatus;
use App\Enums\ProductType;
use App\Enums\Role as RoleEnum;
use App\Models\Course;
use App\Models\CourseQuestion;
use App\Models\CourseReview;
use App\Models\CourseWishlist;
use App\Models\Order;
use App\Models\Price;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Role;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentService;
use App\Services\Lms\ProgressService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Demonstration data for a local walkthrough: a customer who has bought a course
 * and a licence, with the progress, questions, tickets and requests that a real
 * account accumulates.
 *
 * Two rules make this safe.
 *
 * It refuses to run outside local and testing. The prices here are invented for
 * the demo, and the owner has not set real ones — so this seeder must never be
 * able to put a number in front of a paying customer.
 *
 * It drives the real services rather than writing rows directly. The enrolment,
 * invoice, licence and download entitlement below are produced by
 * FulfillmentService exactly as a genuine purchase would produce them, so the
 * demo cannot show a state the application itself could never reach.
 */
class DemoSeeder extends Seeder
{
    public const CUSTOMER_EMAIL = 'user@nuruzzaman.com.bd';

    /**
     * What the demo order was "charged", in minor units.
     *
     * Placeholders for the walkthrough, kept out of the catalogue so no visitor
     * ever sees them as the owner's pricing.
     */
    private const DEMO_LINE_AMOUNTS = [
        'NBET-V6-SINGLE' => 1500000,
    ];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->warn('DemoSeeder is for local use only; skipped.');

            return;
        }

        $password = (string) (config('nb.seed.demo_password') ?: 'DemoUser!2026');

        $customer = $this->customer($password);
        $course = Course::query()->published()->orderBy('id')->first();

        if (! $course) {
            $this->command?->warn('No published course found; demo data skipped.');

            return;
        }

        $this->priceTheCatalogue($course);
        $order = $this->purchase($customer, $course);
        $this->study($customer, $course);
        $this->support($customer, $order);

        $this->command?->info('Demo customer ready: '.self::CUSTOMER_EMAIL);
    }

    private function customer(string $password): User
    {
        $user = User::query()->firstOrNew(['email' => self::CUSTOMER_EMAIL]);

        if (! $user->exists) {
            $user->fill([
                'name' => 'Demo Customer',
                'password' => Hash::make($password),
                'status' => 'active',
            ]);
            $user->email_verified_at = now();
            $user->save();

            $this->command?->line('  demo password: '.$password);
        }

        $role = Role::query()->where('name', RoleEnum::Customer->value)->first();

        if ($role && ! $user->roles()->whereKey($role->getKey())->exists()) {
            $user->roles()->attach($role);
        }

        return $user->fresh();
    }

    /**
     * Gives the demo course a purchasable variant and publishes demo prices.
     *
     * These figures are placeholders for the walkthrough, not the owner's
     * pricing, which is why this whole seeder is barred from production.
     */
    private function priceTheCatalogue(Course $course): void
    {
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
            ['amount_minor' => 250000, 'is_active' => true],
        );

        // No price row is created for the NB Engineering Tools licence. The owner
        // has not set its price, so the public page must keep saying "contact for
        // price"; a price row here would put a number the owner never chose in
        // front of a visitor. The demo order below carries its own line amount
        // instead, which is where a real order's figures live anyway.
    }

    /** Places a paid order and lets FulfillmentService grant everything. */
    private function purchase(User $customer, Course $course): Order
    {
        $existing = Order::query()->where('user_id', $customer->getKey())->first();

        if ($existing) {
            return $existing;
        }

        $variants = ProductVariant::query()
            ->whereIn('sku', ['NBET-V6-SINGLE', 'CRS-'.Str::upper(Str::substr(md5($course->slug), 0, 8))])
            ->with(['product', 'prices'])
            ->get();

        $order = Order::query()->create([
            'number' => 'NB-'.now()->format('Ymd').'-0001',
            'user_id' => $customer->getKey(),
            'status' => OrderStatus::Paid,
            'currency' => 'BDT',
            'billing_name' => $customer->name,
            'billing_email' => $customer->email,
            'accepted_terms' => true,
            'terms_accepted_at' => now()->subDays(6),
            'subtotal_minor' => 0,
            'discount_minor' => 0,
            'tax_minor' => 0,
            'total_minor' => 0,
            'placed_at' => now()->subDays(6),
            'paid_at' => now()->subDays(6),
        ]);

        $subtotal = 0;

        foreach ($variants as $variant) {
            // An order item stores the amount charged at the time of sale, so the
            // demo total does not depend on a published price existing now.
            $amount = (int) (self::DEMO_LINE_AMOUNTS[$variant->sku]
                ?? $variant->prices->firstWhere('is_active', true)?->amount_minor
                ?? 0);
            $subtotal += $amount;

            $order->items()->create([
                'product_variant_id' => $variant->getKey(),
                'product_type' => $variant->product->type->value,
                'product_name' => $variant->product->name,
                'variant_name' => $variant->name,
                'sku' => $variant->sku,
                'quantity' => 1,
                'unit_price_minor' => $amount,
                'line_total_minor' => $amount,
                'fulfillment_meta' => [
                    'course_id' => $variant->course_id,
                    'device_limit' => $variant->device_limit,
                    'license_term_days' => $variant->license_term_days,
                    'access_duration_days' => $variant->access_duration_days,
                ],
            ]);
        }

        $order->forceFill([
            'subtotal_minor' => $subtotal,
            'total_minor' => $subtotal,
        ])->save();

        // The real fulfilment path: enrolment, invoice, licence, entitlement.
        app(FulfillmentService::class)->fulfill($order->fresh(['items.variant.product', 'user']));

        return $order->fresh();
    }

    /** Progress, a note, a moderated question, a review and a wishlist entry. */
    private function study(User $customer, Course $course): void
    {
        $enrollment = $customer->enrollments()->where('course_id', $course->getKey())->first();

        if (! $enrollment) {
            return;
        }

        // Completion is recorded through the service, so progress_percent is
        // derived the same way it is for a real learner.
        $progress = app(ProgressService::class);

        foreach ($course->lessons()->orderBy('position')->take(2)->get() as $lesson) {
            $progress->complete($enrollment, $lesson);
        }

        $enrollment->notes()->firstOrCreate(
            ['lesson_id' => $course->lessons()->orderBy('position')->first()?->getKey()],
            [
                'user_id' => $customer->getKey(),
                'body' => 'Punching shear-এর হিসাবটা আবার দেখতে হবে — d/2 কোথায় ধরেছি।',
            ],
        );

        CourseQuestion::query()->firstOrCreate(
            ['course_id' => $course->getKey(), 'user_id' => $customer->getKey()],
            [
                'enrollment_id' => $enrollment->getKey(),
                'title' => 'Cover ৭৫ mm কেন ধরা হলো?',
                'body' => 'ফুটিংয়ের নিচে ৭৫ mm cover ধরা হয়েছে। এটি কি সব মাটিতেই একই থাকবে?',
                'status' => ContentStatus::Published,
                'answered_at' => now()->subDay(),
            ],
        );

        CourseReview::query()->firstOrCreate(
            ['course_id' => $course->getKey(), 'user_id' => $customer->getKey()],
            [
                'enrollment_id' => $enrollment->getKey(),
                'rating' => 5,
                'title' => 'হিসাবগুলো ধাপে ধাপে',
                'body' => 'প্রতিটি অ্যাজাম্পশন আলাদা করে লেখা থাকায় নিজের প্রকল্পে মেলাতে সুবিধা হয়েছে।',
                // Held for moderation, like any real review, so the aggregate
                // rating stays empty until staff publish it.
                'status' => ContentStatus::InReview,
            ],
        );

        $other = Course::query()->published()->where('id', '!=', $course->getKey())->first();

        if ($other) {
            CourseWishlist::query()->firstOrCreate([
                'user_id' => $customer->getKey(),
                'course_id' => $other->getKey(),
            ]);
        }
    }

    /** A support ticket and an activation request against the real order. */
    private function support(User $customer, Order $order): void
    {
        $ticket = SupportTicket::query()->firstOrCreate(
            ['user_id' => $customer->getKey(), 'subject' => 'Machine ID কোথায় পাব?'],
            [
                'reference' => 'TKT-'.Str::upper(Str::random(8)),
                'name' => $customer->name,
                'email' => $customer->email,
                'category' => 'activation',
                'status' => 'open',
                'priority' => 'normal',
                'order_id' => $order->getKey(),
            ],
        );

        $ticket->messages()->firstOrCreate(
            ['author_id' => $customer->getKey()],
            [
                'author_kind' => 'customer',
                'body' => 'AutoCAD-এ Ribbon দেখতে পাচ্ছি, কিন্তু License & Tokens ইন্টারফেস কোথায় বুঝতে পারছি না।',
                'is_internal' => false,
            ],
        );
    }
}
