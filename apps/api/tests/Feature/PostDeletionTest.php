<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Jobs\RevalidateFrontend;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/** Deleting articles from the dashboard list, one or several at a time. */
class PostDeletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_deleted_article_leaves_the_site_at_once(): void
    {
        Queue::fake();
        $post = Post::factory()->published()->create(['slug' => 'footing-notes']);
        $this->getJson('/api/v1/posts/footing-notes')->assertOk();

        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->deleteJson('/api/v1/admin/posts/'.$post->id)->assertOk();

        // Trash, not erased: the row is still there to recover from.
        $this->assertSoftDeleted('posts', ['id' => $post->id]);
        $this->getJson('/api/v1/posts/footing-notes')->assertNotFound();

        // A page that is gone must not keep being served from the cache.
        Queue::assertPushed(
            RevalidateFrontend::class,
            fn (RevalidateFrontend $job) => in_array('post:footing-notes', $job->tags, true)
                && in_array('posts', $job->tags, true),
        );
        $this->assertDatabaseHas('audit_logs', ['action' => 'post.deleted']);
    }

    public function test_several_are_deleted_one_after_another(): void
    {
        $posts = Post::factory()->count(3)->create();
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        foreach ($posts as $post) {
            $this->deleteJson('/api/v1/admin/posts/'.$post->id)->assertOk();
        }

        $this->assertSame(0, Post::query()->count());
        $this->assertSame(3, Post::withTrashed()->count());
    }

    public function test_someone_who_may_not_delete_is_refused(): void
    {
        $post = Post::factory()->create();
        $this->actingAs($this->userWithRole(Role::Support));

        $this->deleteJson('/api/v1/admin/posts/'.$post->id)->assertForbidden();
        $this->assertNotSoftDeleted('posts', ['id' => $post->id]);
    }
}
