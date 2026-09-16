<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\Role;
use App\Models\Course;
use App\Models\Post;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The bulk actions above the dashboard lists move rows between statuses one
 * transition at a time, so what matters is that each transition is allowed,
 * that it says so plainly when it is not, and that it works the same way for
 * an article, a product and a course.
 */
class BulkStatusChangeTest extends TestCase
{
    use RefreshDatabase;

    public function test_articles_are_moved_to_another_status_one_by_one(): void
    {
        $posts = Post::factory()->count(2)->published()->create();
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        foreach ($posts as $post) {
            $this->postJson('/api/v1/admin/posts/'.$post->id.'/transition', ['status' => 'archived'])
                ->assertOk();
        }

        $this->assertSame(
            [ContentStatus::Archived, ContentStatus::Archived],
            $posts->map(fn (Post $post) => $post->refresh()->status)->all(),
        );
    }

    public function test_a_published_page_cannot_slip_sideways_and_is_told_where_it_may_go(): void
    {
        $post = Post::factory()->published()->create();
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $response = $this->postJson('/api/v1/admin/posts/'.$post->id.'/transition', [
            'status' => 'in_review',
        ])->assertStatus(409);

        $message = (string) $response->json('error.message');
        $this->assertStringContainsString('cannot become in_review', $message);
        // The refusal names the way out rather than leaving the editor guessing.
        $this->assertStringContainsString('draft, archived', $message);
        $this->assertSame(ContentStatus::Published, $post->refresh()->status);
    }

    public function test_scheduling_asks_for_the_date_first(): void
    {
        $post = Post::factory()->create(['status' => ContentStatus::Draft, 'scheduled_for' => null]);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->postJson('/api/v1/admin/posts/'.$post->id.'/transition', ['status' => 'scheduled'])
            ->assertStatus(422);

        $this->assertSame(ContentStatus::Draft, $post->refresh()->status);
    }

    public function test_products_and_courses_move_the_same_way(): void
    {
        $product = Product::factory()->create(['status' => ContentStatus::Draft]);
        $course = Course::factory()->create(['status' => ContentStatus::Draft]);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->postJson('/api/v1/admin/products/'.$product->id.'/transition', ['status' => 'published'])
            ->assertOk();
        $this->postJson('/api/v1/admin/courses/'.$course->id.'/transition', ['status' => 'archived'])
            ->assertOk();

        $this->assertSame(ContentStatus::Published, $product->refresh()->status);
        $this->assertNotNull($product->published_at);
        $this->assertSame(ContentStatus::Archived, $course->refresh()->status);
    }
}
