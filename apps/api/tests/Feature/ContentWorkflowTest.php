<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\Role as RoleEnum;
use App\Jobs\RevalidateFrontend;
use App\Models\Course;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class ContentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_publishing_an_article_asks_the_frontend_to_revalidate(): void
    {
        Bus::fake();
        $this->seedRoles();

        $editor = $this->userWithRole(RoleEnum::Editor);
        $post = Post::factory()->create(['slug' => 'a-new-article']);

        $this->actingAs($editor)
            ->postJson('/api/v1/admin/posts/'.$post->id.'/transition', ['status' => 'published'])
            ->assertOk();

        $this->assertSame(ContentStatus::Published, $post->fresh()->status);
        $this->assertDatabaseHas('publishing_events', ['to_status' => 'published']);

        Bus::assertDispatched(
            RevalidateFrontend::class,
            fn (RevalidateFrontend $job) => in_array('post:a-new-article', $job->tags, true),
        );
    }

    public function test_an_illegal_status_jump_is_refused(): void
    {
        $this->seedRoles();
        $editor = $this->userWithRole(RoleEnum::Editor);

        $post = Post::factory()->published()->create();

        // published -> scheduled is not allowed.
        $this->actingAs($editor)
            ->postJson('/api/v1/admin/posts/'.$post->id.'/transition', ['status' => 'scheduled'])
            ->assertStatus(409);
    }

    public function test_scheduling_requires_a_date(): void
    {
        $this->seedRoles();
        $editor = $this->userWithRole(RoleEnum::Editor);
        $post = Post::factory()->create();

        $this->actingAs($editor)
            ->postJson('/api/v1/admin/posts/'.$post->id.'/transition', ['status' => 'scheduled'])
            ->assertStatus(422);
    }

    public function test_editing_snapshots_a_revision_that_can_be_restored(): void
    {
        $this->seedRoles();
        $editor = $this->userWithRole(RoleEnum::Editor);

        $post = Post::factory()->create([
            'title' => 'Original title',
            'body_markdown' => 'Original body.',
        ]);

        $this->actingAs($editor)
            ->patchJson('/api/v1/admin/posts/'.$post->id, [
                'title' => 'Rewritten title',
                'body_markdown' => 'Rewritten body.',
            ])
            ->assertOk();

        $this->assertSame('Rewritten title', $post->fresh()->title);

        $revisions = $this->actingAs($editor)
            ->getJson('/api/v1/admin/posts/'.$post->id.'/revisions')
            ->assertOk()
            ->json('data');

        $this->assertSame('Original title', $revisions[0]['title']);

        $this->actingAs($editor)
            ->postJson('/api/v1/admin/posts/'.$post->id.'/revisions/1/restore')
            ->assertOk()
            ->assertJsonPath('data.title', 'Original title');
    }

    public function test_the_scheduler_publishes_content_whose_time_has_come(): void
    {
        Bus::fake();

        Post::factory()->create([
            'status' => ContentStatus::Scheduled,
            'scheduled_for' => now()->subMinute(),
        ]);

        Post::factory()->create([
            'status' => ContentStatus::Scheduled,
            'scheduled_for' => now()->addDay(),
        ]);

        $this->artisan('content:publish-due')->assertExitCode(0);

        $this->assertSame(1, Post::query()->where('status', ContentStatus::Published->value)->count());
    }

    public function test_a_course_cannot_be_published_without_a_lesson(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $course = Course::factory()->create();

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/courses/'.$course->id.'/transition', ['status' => 'published'])
            ->assertStatus(422);
    }
}
