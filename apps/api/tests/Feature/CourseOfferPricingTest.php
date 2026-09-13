<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Course;
use App\Models\Price;
use App\Models\ProductVariant;
use App\Services\Commerce\PricingService;
use App\Services\Lms\EnrollmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A course's price from the editor: free, a regular price, and an offer that
 * ends by itself.
 */
class CourseOfferPricingTest extends TestCase
{
    use RefreshDatabase;

    /** Published as the public pages count it: with at least one lesson. */
    private function publishedCourse(): Course
    {
        $course = Course::factory()->published()->create([]);
        $section = $course->sections()->create(['title' => 'Class one']);
        $course->lessons()->create([
            'course_section_id' => $section->id,
            'title' => 'Lesson one',
            'slug' => 'lesson-one',
            'type' => 'text',
        ]);

        return $course;
    }

    private function variant(Course $course): ProductVariant
    {
        return ProductVariant::query()->where('course_id', $course->id)->with('prices')->firstOrFail();
    }

    private function savePricing(Course $course, array $pricing)
    {
        return $this->actingAs($this->userWithRole(Role::SuperAdmin))
            ->patchJson('/api/v1/admin/courses/'.$course->id, ['pricing' => $pricing]);
    }

    public function test_an_offer_is_charged_until_it_ends_and_then_the_regular_price_returns(): void
    {
        $course = $this->publishedCourse();

        $this->savePricing($course, [
            'type' => 'paid',
            'regular_minor' => 1000000,
            'offer_minor' => 500000,
            'offer_ends_at' => now()->addHours(72)->toIso8601String(),
        ])->assertOk();

        $price = $this->variant($course)->currentPrice();
        $this->assertSame(500000, $price->amount_minor);
        $this->assertSame(1000000, $price->compare_at_minor);

        $this->getJson('/api/v1/courses/'.$course->slug)
            ->assertOk()
            ->assertJsonPath('data.variants.0.price.amount_minor', 500000)
            ->assertJsonPath('data.variants.0.price.compare_at_minor', 1000000)
            ->assertJsonPath('data.variants.0.price.offer_ends_at', fn ($value) => is_string($value));

        $this->getJson('/api/v1/admin/courses/'.$course->id.'/curriculum')
            ->assertOk()
            ->assertJsonPath('data.pricing.type', 'paid')
            ->assertJsonPath('data.pricing.regular_minor', 1000000)
            ->assertJsonPath('data.pricing.offer_minor', 500000);

        $this->travel(73)->hours();

        $price = $this->variant($course)->currentPrice();
        $this->assertSame(1000000, $price->amount_minor);
        $this->assertNull($price->compare_at_minor);

        $this->getJson('/api/v1/admin/courses/'.$course->id.'/curriculum')
            ->assertJsonPath('data.pricing.regular_minor', 1000000)
            ->assertJsonPath('data.pricing.offer_minor', null);
    }

    public function test_saving_an_unchanged_offer_does_not_restart_its_countdown(): void
    {
        $course = $this->publishedCourse();
        $plan = [
            'type' => 'paid',
            'regular_minor' => 1000000,
            'offer_minor' => 500000,
            'offer_ends_at' => now()->addHours(48)->startOfMinute()->toIso8601String(),
        ];

        $this->savePricing($course, $plan)->assertOk();
        $rows = Price::query()->count();
        $endsAt = $this->variant($course)->currentPrice()->ends_at->getTimestamp();

        $this->travel(2)->hours();
        $this->savePricing($course, $plan)->assertOk();

        $this->assertSame($rows, Price::query()->count());
        $this->assertSame($endsAt, $this->variant($course)->currentPrice()->ends_at->getTimestamp());

        // Turning the offer off leaves only the regular price in effect.
        $this->savePricing($course, ['type' => 'paid', 'regular_minor' => 1000000])->assertOk();
        $this->assertSame(1000000, $this->variant($course)->currentPrice()->amount_minor);
        $this->assertSame(1, Price::query()->where('is_active', true)->count());
    }

    public function test_a_free_course_is_joined_from_its_page_not_through_checkout(): void
    {
        $course = $this->publishedCourse();
        $this->savePricing($course, ['type' => 'free'])->assertOk();

        $variant = $this->variant($course);
        $this->assertSame(0, $variant->currentPrice()->amount_minor);
        $this->getJson('/api/v1/courses/'.$course->slug)->assertJsonPath('data.variants.0.price.amount_minor', 0);

        $line = app(PricingService::class)->lineFor($variant, 1);
        $this->assertFalse($line->isPurchasable());
        $this->assertStringContainsString('free', $line->unavailableReason);

        $student = $this->customer(['account_mode' => 'student']);
        $this->actingAs($student)->postJson('/api/v1/learn/'.$course->slug.'/enroll-free')
            ->assertCreated()
            ->assertJsonPath('data.learn_url', '/learn/'.$course->slug);

        $this->assertDatabaseHas('enrollments', [
            'user_id' => $student->id,
            'course_id' => $course->id,
            'source' => 'free',
            'status' => 'active',
        ]);

        // Joining again changes nothing.
        $this->postJson('/api/v1/learn/'.$course->slug.'/enroll-free')->assertOk();
        $this->getJson('/api/v1/learn/'.$course->slug.'/outline')->assertOk();
    }

    public function test_only_a_published_free_course_can_be_joined_for_free(): void
    {
        $paid = $this->publishedCourse();
        $this->savePricing($paid, ['type' => 'paid', 'regular_minor' => 500000])->assertOk();

        $draft = Course::factory()->create();
        $this->savePricing($draft, ['type' => 'free'])->assertOk();

        $free = $this->publishedCourse();
        $this->savePricing($free, ['type' => 'free'])->assertOk();

        $student = $this->customer(['account_mode' => 'student']);
        $this->actingAs($student);

        $this->postJson('/api/v1/learn/'.$paid->slug.'/enroll-free')->assertUnprocessable();
        $this->postJson('/api/v1/learn/'.$draft->slug.'/enroll-free')->assertNotFound();

        $enrollments = app(EnrollmentService::class);
        $enrollments->revoke($enrollments->enroll($student, $free, null, 'free'), 'Withdrawn by staff');

        $this->postJson('/api/v1/learn/'.$free->slug.'/enroll-free')->assertForbidden();
    }

    public function test_an_offer_must_be_cheaper_and_end_in_the_future(): void
    {
        $course = $this->publishedCourse();

        $this->savePricing($course, [
            'type' => 'paid', 'regular_minor' => 500000, 'offer_minor' => 500000,
            'offer_ends_at' => now()->addDay()->toIso8601String(),
        ])->assertUnprocessable()->assertJsonValidationErrors('pricing.offer_minor', 'error.fields');

        $this->savePricing($course, [
            'type' => 'paid', 'regular_minor' => 500000, 'offer_minor' => 250000,
            'offer_ends_at' => now()->subHour()->toIso8601String(),
        ])->assertUnprocessable()->assertJsonValidationErrors('pricing.offer_ends_at', 'error.fields');

        $this->savePricing($course, [
            'type' => 'paid', 'regular_minor' => 500000, 'offer_minor' => 250000,
        ])->assertUnprocessable()->assertJsonValidationErrors('pricing.offer_ends_at', 'error.fields');

        $this->savePricing($course, ['type' => 'paid'])
            ->assertUnprocessable()->assertJsonValidationErrors('pricing.regular_minor', 'error.fields');
    }
}
