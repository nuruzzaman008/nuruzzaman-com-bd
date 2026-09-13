<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\Media;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * An article's featured image, as the post editor sets it.
 *
 * The editor only sends cover_media_id when the image was actually changed.
 * Everything else it sends - the title, the body, the SEO fields - must leave
 * the image exactly as it was, so writing can never cost a post its picture.
 */
class AdminPostCoverTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_editor_is_told_which_image_a_post_uses(): void
    {
        $this->seedRoles();
        $editor = $this->userWithRole(RoleEnum::Editor);
        $medium = Media::factory()->create(['alt_text' => 'Bolted end plate']);
        $post = Post::factory()->create(['cover_media_id' => $medium->id]);

        $this->actingAs($editor)
            ->getJson('/api/v1/admin/posts/'.$post->id)
            ->assertOk()
            ->assertJsonPath('data.cover_media_id', $medium->id)
            ->assertJsonPath('data.cover_alt', 'Bolted end plate');
    }

    public function test_a_reader_is_never_given_the_cover_id(): void
    {
        $medium = Media::factory()->create();
        $post = Post::factory()->published()->create(['cover_media_id' => $medium->id]);

        $this->getJson('/api/v1/posts/'.$post->slug)
            ->assertOk()
            ->assertJsonMissingPath('data.cover_media_id');
    }

    public function test_saving_the_words_keeps_the_existing_image(): void
    {
        $this->seedRoles();
        $editor = $this->userWithRole(RoleEnum::Editor);
        $medium = Media::factory()->create();
        $post = Post::factory()->create(['cover_media_id' => $medium->id]);

        // What the editor sends when the image was not touched: no cover key.
        $this->actingAs($editor)
            ->patchJson('/api/v1/admin/posts/'.$post->id, [
                'title' => 'A new title',
                'body_markdown' => 'A rewritten body.',
                'seo' => ['meta_title' => 'A title for search'],
            ])
            ->assertOk();

        $fresh = $post->fresh();
        $this->assertSame('A new title', $fresh->title);
        $this->assertSame($medium->id, $fresh->cover_media_id);
    }

    public function test_an_editor_sets_and_clears_a_post_cover(): void
    {
        $this->seedRoles();
        $editor = $this->userWithRole(RoleEnum::Editor);
        $medium = Media::factory()->create();
        $post = Post::factory()->create(['cover_media_id' => null]);

        $this->actingAs($editor)
            ->patchJson('/api/v1/admin/posts/'.$post->id, ['cover_media_id' => $medium->id])
            ->assertOk();

        $this->assertSame($medium->id, $post->fresh()->cover_media_id);

        // Cleared, the site goes back to the generated cover.
        $this->actingAs($editor)
            ->patchJson('/api/v1/admin/posts/'.$post->id, ['cover_media_id' => null])
            ->assertOk();

        $this->assertNull($post->fresh()->cover_media_id);
    }

    public function test_an_image_that_does_not_exist_is_refused(): void
    {
        $this->seedRoles();
        $editor = $this->userWithRole(RoleEnum::Editor);
        $medium = Media::factory()->create();
        $post = Post::factory()->create(['cover_media_id' => $medium->id]);

        $this->actingAs($editor)
            ->patchJson('/api/v1/admin/posts/'.$post->id, ['cover_media_id' => 999999])
            ->assertStatus(422);

        $this->assertSame($medium->id, $post->fresh()->cover_media_id);
    }
}
