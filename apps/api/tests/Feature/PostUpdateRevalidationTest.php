<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Jobs\RevalidateFrontend;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/** Saving a published article shows the change on its page straight away, not when the cache expires. */
class PostUpdateRevalidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_saving_an_article_refreshes_its_page_and_any_old_address(): void
    {
        Queue::fake();

        $editor = $this->userWithRole(Role::Editor);
        $post = Post::factory()->published()->create(['slug' => 'steel-bolt-shear']);

        $this->actingAs($editor)->patchJson('/api/v1/admin/posts/'.$post->id, [
            'slug' => 'steel-connection-bolt-shear',
            'body_markdown' => "Intro\n\n![Walkthrough](/storage/uploads/2026/09/walk.mp4)",
        ])->assertOk();

        Queue::assertPushed(RevalidateFrontend::class, fn (RevalidateFrontend $job) => in_array('posts', $job->tags, true)
            && in_array('post:steel-connection-bolt-shear', $job->tags, true)
            && in_array('post:steel-bolt-shear', $job->tags, true)
            && in_array('sitemap', $job->tags, true));
    }
}
