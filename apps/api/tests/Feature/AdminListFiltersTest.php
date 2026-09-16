<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\OrderStatus;
use App\Enums\ProductType;
use App\Enums\Role;
use App\Models\Category;
use App\Models\Course;
use App\Models\Order;
use App\Models\Post;
use App\Models\Product;
use App\Models\Tag;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The filter bar above the dashboard lists: a status with its count, a month,
 * and the taxonomy each kind of content is sorted by.
 */
class AdminListFiltersTest extends TestCase
{
    use RefreshDatabase;

    public function test_articles_are_filtered_by_status_month_category_and_tag(): void
    {
        $category = Category::query()->create(['slug' => 'rcc', 'name' => 'RCC']);
        $tag = Tag::query()->create(['slug' => 'footing', 'name' => 'Footing']);

        $september = Post::factory()->published()->create([
            'slug' => 'september-post',
            'published_at' => '2026-09-10 10:00:00',
        ]);
        $september->categories()->attach($category);
        $september->tags()->attach($tag);

        Post::factory()->published()->create([
            'slug' => 'august-post',
            'published_at' => '2026-08-10 10:00:00',
        ]);
        Post::factory()->create(['slug' => 'a-draft', 'status' => ContentStatus::Draft])
            ->forceFill(['created_at' => '2026-05-02 09:00:00'])->saveQuietly();

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        // Counts describe the whole list, and name every status, even empty ones.
        $all = $this->getJson('/api/v1/admin/posts')->assertOk();
        $this->assertSame(3, $all->json('filters.counts.all'));
        $this->assertSame(2, $all->json('filters.counts.published'));
        $this->assertSame(1, $all->json('filters.counts.draft'));
        $this->assertSame(0, $all->json('filters.counts.archived'));
        $this->assertContains('2026-09', $all->json('filters.months'));
        $this->assertContains('2026-08', $all->json('filters.months'));

        $this->assertSame(
            ['a-draft'],
            $this->getJson('/api/v1/admin/posts?status=draft')->assertOk()->json('data.*.slug'),
        );
        $this->assertSame(
            ['september-post'],
            $this->getJson('/api/v1/admin/posts?month=2026-09')->assertOk()->json('data.*.slug'),
        );
        $this->assertSame(
            ['september-post'],
            $this->getJson('/api/v1/admin/posts?category=rcc')->assertOk()->json('data.*.slug'),
        );
        $this->assertSame(
            ['september-post'],
            $this->getJson('/api/v1/admin/posts?tag=footing')->assertOk()->json('data.*.slug'),
        );

        // A month narrows the counts too: that is what the number is for.
        $narrowed = $this->getJson('/api/v1/admin/posts?month=2026-09')->assertOk();
        $this->assertSame(1, $narrowed->json('filters.counts.all'));
    }

    public function test_a_draft_is_filed_under_the_month_it_was_made(): void
    {
        $draft = Post::factory()->create(['slug' => 'unpublished', 'status' => ContentStatus::Draft]);
        $draft->forceFill(['created_at' => '2026-07-04 09:00:00'])->saveQuietly();

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->assertSame(
            ['unpublished'],
            $this->getJson('/api/v1/admin/posts?month=2026-07')->assertOk()->json('data.*.slug'),
        );
    }

    public function test_products_are_filtered_by_kind_and_status(): void
    {
        Product::factory()->create(['slug' => 'tools', 'status' => ContentStatus::Published]);
        Product::factory()->ofType(ProductType::CreditRefill)
            ->create(['slug' => 'refill', 'status' => ContentStatus::Draft]);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $response = $this->getJson('/api/v1/admin/products?type=credit_refill')->assertOk();
        $this->assertSame(['refill'], $response->json('data.*.slug'));
        $this->assertContains('credit_refill', $response->json('filters.types'));

        $this->assertSame(
            ['tools'],
            $this->getJson('/api/v1/admin/products?status=published')->assertOk()->json('data.*.slug'),
        );
    }

    public function test_courses_are_filtered_by_level_and_status_with_labelled_tracks(): void
    {
        Course::factory()->create([
            'slug' => 'beginner-course',
            'level' => 'beginner',
            'track' => 'autocad-productivity',
            'status' => ContentStatus::Published,
        ]);
        Course::factory()->create(['slug' => 'advanced-course', 'level' => 'advanced']);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $response = $this->getJson('/api/v1/admin/courses?level=beginner')->assertOk();
        $this->assertSame(['beginner-course'], $response->json('data.*.slug'));

        $tracks = $this->getJson('/api/v1/admin/courses')->assertOk()->json('filters.tracks');
        $this->assertSame('autocad-productivity', $tracks[0]['value']);
        $this->assertNotSame('', $tracks[0]['label']);

        $this->assertSame(
            ['beginner-course'],
            $this->getJson('/api/v1/admin/courses?status=published')->assertOk()->json('data.*.slug'),
        );
    }

    public function test_orders_are_counted_by_status_and_filtered_by_the_month_they_were_placed(): void
    {
        $september = Order::factory()->create(['status' => OrderStatus::PendingPayment, 'placed_at' => '2026-09-14 10:00:00']);
        Order::factory()->paid()->create(['placed_at' => '2026-08-02 10:00:00']);
        Order::factory()->create(['status' => OrderStatus::Failed, 'placed_at' => '2026-08-20 10:00:00']);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $all = $this->getJson('/api/v1/admin/orders')->assertOk();
        $this->assertSame(3, $all->json('filters.counts.all'));
        $this->assertSame(1, $all->json('filters.counts.pending_payment'));
        $this->assertSame(1, $all->json('filters.counts.paid'));
        $this->assertSame(0, $all->json('filters.counts.refunded'));
        $this->assertSame(['2026-09', '2026-08'], $all->json('filters.months'));

        $this->assertSame(
            [$september->number],
            $this->getJson('/api/v1/admin/orders?month=2026-09')->assertOk()->json('data.*.number'),
        );

        // The month narrows the counts, and the status narrows the rows.
        $august = $this->getJson('/api/v1/admin/orders?month=2026-08&status=failed')->assertOk();
        $this->assertSame(2, $august->json('filters.counts.all'));
        $this->assertCount(1, $august->json('data'));

        // An empty filter from the form is no filter at all.
        $this->getJson('/api/v1/admin/orders?status=&month=&q=')->assertOk();
    }

    public function test_a_month_that_is_not_a_month_is_refused(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->getJson('/api/v1/admin/posts?month=september')->assertStatus(422);
        $this->getJson('/api/v1/admin/posts?month=2026-13')->assertStatus(422);
    }
}
