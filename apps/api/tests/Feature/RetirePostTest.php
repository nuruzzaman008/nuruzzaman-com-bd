<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\Role;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Taking a post off the site through the publishing workflow, from the command line. */
class RetirePostTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_published_post_is_archived_against_the_owner_and_leaves_the_site(): void
    {
        $owner = $this->userWithRole(Role::SuperAdmin);
        $post = Post::factory()->published()->create(['slug' => 'nb-engineering-tools-workflow-overview']);
        $this->getJson('/api/v1/posts/nb-engineering-tools-workflow-overview')->assertOk();

        $this->artisan('content:retire-post', ['slug' => $post->slug, '--note' => 'Merged into /engineering-tools'])
            ->assertSuccessful();

        $this->assertSame(ContentStatus::Archived, $post->refresh()->status);
        $this->assertDatabaseHas('publishing_events', [
            'publishable_id' => $post->id,
            'from_status' => 'published',
            'to_status' => 'archived',
            'actor_id' => $owner->id,
            'note' => 'Merged into /engineering-tools',
        ]);
        $this->getJson('/api/v1/posts/nb-engineering-tools-workflow-overview')->assertNotFound();

        // Running it again changes nothing and is not an error.
        $this->artisan('content:retire-post', ['slug' => $post->slug])->assertSuccessful();
        $this->assertDatabaseCount('publishing_events', 1);
    }

    public function test_nothing_changes_without_the_post_or_an_owner_to_record_it_against(): void
    {
        $this->artisan('content:retire-post', ['slug' => 'no-such-post'])->assertFailed();

        $post = Post::factory()->published()->create();
        $this->artisan('content:retire-post', ['slug' => $post->slug])->assertFailed();

        $this->assertSame(ContentStatus::Published, $post->refresh()->status);
        $this->assertDatabaseCount('publishing_events', 0);
    }
}
