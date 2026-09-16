<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Jobs\RevalidateFrontend;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Deleting products and courses from the dashboard lists, and the two things
 * that stop it: an order that points at the product, and a learner enrolled in
 * the course.
 */
class ContentDeletionGuardsTest extends TestCase
{
    use RefreshDatabase;

    private function orderFor(ProductVariant $variant): void
    {
        Order::factory()->paid()->create()->items()->create([
            'product_variant_id' => $variant->getKey(),
            'product_type' => 'software_license',
            'product_name' => 'NB Engineering Tools',
            'variant_name' => 'Yearly',
            'sku' => $variant->sku,
            'quantity' => 1,
            'unit_price_minor' => 700000,
            'line_total_minor' => 700000,
        ]);
    }

    public function test_a_product_nobody_ordered_is_deleted_and_leaves_the_shop(): void
    {
        Queue::fake();
        $product = Product::factory()->create(['slug' => 'spare-listing']);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->deleteJson('/api/v1/admin/products/'.$product->id)->assertOk();

        $this->assertSoftDeleted('products', ['id' => $product->id]);
        Queue::assertPushed(
            RevalidateFrontend::class,
            fn (RevalidateFrontend $job) => in_array('product:spare-listing', $job->tags, true),
        );
    }

    public function test_a_product_that_has_been_ordered_is_refused_and_kept(): void
    {
        $product = Product::factory()->create();
        $this->orderFor(ProductVariant::factory()->create(['product_id' => $product->id]));

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $response = $this->deleteJson('/api/v1/admin/products/'.$product->id)->assertStatus(409);

        // The message has to say what to do instead, not only refuse.
        $this->assertStringContainsString('Unpublish', (string) $response->json('error.message'));
        $this->assertNotSoftDeleted('products', ['id' => $product->id]);
    }

    public function test_a_course_nobody_learns_from_is_deleted(): void
    {
        Queue::fake();
        $course = Course::factory()->create(['slug' => 'draft-course']);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->deleteJson('/api/v1/admin/courses/'.$course->id)->assertOk();

        $this->assertSoftDeleted('courses', ['id' => $course->id]);
        Queue::assertPushed(
            RevalidateFrontend::class,
            fn (RevalidateFrontend $job) => in_array('course:draft-course', $job->tags, true),
        );
    }

    public function test_a_course_with_a_learner_in_it_is_refused_and_kept(): void
    {
        $course = Course::factory()->create();
        Enrollment::create([
            'user_id' => $this->userWithRole(Role::Customer)->id,
            'course_id' => $course->id,
            'status' => 'active',
            'starts_at' => now(),
        ]);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $response = $this->deleteJson('/api/v1/admin/courses/'.$course->id)->assertStatus(409);

        $this->assertStringContainsString('enrolled', (string) $response->json('error.message'));
        $this->assertNotSoftDeleted('courses', ['id' => $course->id]);
    }

    public function test_an_editor_may_not_delete_a_product_or_a_course(): void
    {
        $product = Product::factory()->create();
        $course = Course::factory()->create();
        $this->actingAs($this->userWithRole(Role::Editor));

        $this->deleteJson('/api/v1/admin/products/'.$product->id)->assertForbidden();
        $this->deleteJson('/api/v1/admin/courses/'.$course->id)->assertForbidden();
    }
}
