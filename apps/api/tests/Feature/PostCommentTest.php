<?php

namespace Tests\Feature;

use App\Enums\CommentStatus;
use App\Enums\Role as RoleEnum;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Reader comments and star ratings.
 *
 * The rule under test throughout is that nothing a reader writes is visible to
 * anyone else until a person has approved it - not in the list, not in the
 * count, and not in the rating average that the page and its structured data
 * are built from.
 */
class PostCommentTest extends TestCase
{
    use RefreshDatabase;

    private Post $post;

    protected function setUp(): void
    {
        parent::setUp();

        $this->post = Post::factory()->published()->create();
    }

    private function comment(User $author, array $attributes = []): PostComment
    {
        return PostComment::create(array_merge([
            'post_id' => $this->post->getKey(),
            'user_id' => $author->getKey(),
            'author_name' => $author->name,
            'body' => 'A comment left by a reader.',
            'status' => CommentStatus::Approved,
            'approved_at' => now(),
        ], $attributes));
    }

    public function test_a_reader_must_be_signed_in_to_comment(): void
    {
        $this->postJson('/api/v1/posts/'.$this->post->slug.'/comments', [
            'body' => 'Anonymous attempt.',
        ])->assertStatus(401);

        $this->assertSame(0, PostComment::query()->count());
    }

    public function test_a_new_comment_is_held_and_appears_nowhere_until_approved(): void
    {
        $reader = $this->customer();

        $this->actingAs($reader)
            ->postJson('/api/v1/posts/'.$this->post->slug.'/comments', [
                'body' => 'The load combination table was the part I needed.',
                'rating' => 5,
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('post_comments', [
            'post_id' => $this->post->getKey(),
            'status' => CommentStatus::Pending->value,
        ]);

        // Not in the list...
        $this->getJson('/api/v1/posts/'.$this->post->slug.'/comments')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        // ...and not in the count or the average either.
        $this->getJson('/api/v1/posts/'.$this->post->slug)
            ->assertOk()
            ->assertJsonPath('data.comment_count', 0)
            ->assertJsonPath('data.rating', null);
    }

    public function test_an_approved_comment_is_listed_and_counted(): void
    {
        $this->comment($this->customer(), ['rating' => 4]);

        $this->getJson('/api/v1/posts/'.$this->post->slug.'/comments')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.rating', 4)
            // A reader is never told the moderation state of a row.
            ->assertJsonMissingPath('data.0.status');

        $this->getJson('/api/v1/posts/'.$this->post->slug)
            ->assertOk()
            ->assertJsonPath('data.comment_count', 1)
            ->assertJsonPath('data.rating.average', 4)
            ->assertJsonPath('data.rating.count', 1);
    }

    public function test_a_comment_without_a_rating_does_not_drag_the_average_down(): void
    {
        $this->comment($this->customer(), ['rating' => 5]);
        $this->comment($this->customer(), ['rating' => null]);

        $this->getJson('/api/v1/posts/'.$this->post->slug)
            ->assertOk()
            ->assertJsonPath('data.comment_count', 2)
            ->assertJsonPath('data.rating.average', 5)
            // Only the rated one is counted as a rating.
            ->assertJsonPath('data.rating.count', 1);
    }

    public function test_a_reader_may_only_comment_once_on_an_article(): void
    {
        $reader = $this->customer();
        $this->comment($reader);

        $this->actingAs($reader)
            ->postJson('/api/v1/posts/'.$this->post->slug.'/comments', [
                'body' => 'A second thought on the same article.',
            ])
            ->assertStatus(409);
    }

    public function test_the_honeypot_and_the_validation_rules_are_enforced(): void
    {
        $reader = $this->customer();

        $this->actingAs($reader)
            ->postJson('/api/v1/posts/'.$this->post->slug.'/comments', [
                'body' => 'no',
            ])
            ->assertStatus(422);

        $this->actingAs($reader)
            ->postJson('/api/v1/posts/'.$this->post->slug.'/comments', [
                'body' => 'A perfectly ordinary comment.',
                'rating' => 6,
            ])
            ->assertStatus(422);

        $this->actingAs($reader)
            ->postJson('/api/v1/posts/'.$this->post->slug.'/comments', [
                'body' => 'A perfectly ordinary comment.',
                'website' => 'http://spam.example',
            ])
            ->assertStatus(422);

        $this->assertSame(0, PostComment::query()->count());
    }

    public function test_only_a_moderator_can_work_the_queue(): void
    {
        $pending = $this->comment($this->customer(), [
            'status' => CommentStatus::Pending,
            'approved_at' => null,
        ]);

        $this->actingAs($this->customer())
            ->getJson('/api/v1/admin/comments')
            ->assertStatus(403);

        $this->actingAs($this->customer())
            ->postJson('/api/v1/admin/comments/'.$pending->getKey().'/moderate', [
                'status' => 'approved',
            ])
            ->assertStatus(403);
    }

    public function test_a_moderator_approves_a_comment_and_the_page_then_shows_it(): void
    {
        $reader = $this->customer();
        $pending = $this->comment($reader, [
            'status' => CommentStatus::Pending,
            'approved_at' => null,
            'rating' => 5,
        ]);

        $editor = $this->userWithRole(RoleEnum::Editor);

        $this->actingAs($editor)
            ->getJson('/api/v1/admin/comments')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            // A moderator does get the state, and the article it belongs to.
            ->assertJsonPath('data.0.status', 'pending')
            ->assertJsonPath('data.0.post.slug', $this->post->slug);

        $this->actingAs($editor)
            ->postJson('/api/v1/admin/comments/'.$pending->getKey().'/moderate', [
                'status' => 'approved',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->getJson('/api/v1/posts/'.$this->post->slug.'/comments')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/v1/posts/'.$this->post->slug)
            ->assertOk()
            ->assertJsonPath('data.comment_count', 1)
            ->assertJsonPath('data.rating.average', 5);
    }

    public function test_a_rejected_comment_leaves_the_page_again(): void
    {
        $approved = $this->comment($this->customer(), ['rating' => 3]);
        $editor = $this->userWithRole(RoleEnum::Editor);

        $this->actingAs($editor)
            ->postJson('/api/v1/admin/comments/'.$approved->getKey().'/moderate', [
                'status' => 'rejected',
            ])
            ->assertOk();

        $this->getJson('/api/v1/posts/'.$this->post->slug)
            ->assertOk()
            ->assertJsonPath('data.comment_count', 0)
            ->assertJsonPath('data.rating', null);
    }
}
