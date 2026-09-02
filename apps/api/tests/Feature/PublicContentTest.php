<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Models\Course;
use App\Models\Page;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicContentTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_published_posts_are_listed(): void
    {
        Post::factory()->published()->create(['title' => 'Published article']);
        Post::factory()->create(['title' => 'Draft article']);

        $this->getJson('/api/v1/posts')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Published article');
    }

    public function test_a_draft_post_is_not_reachable_by_slug(): void
    {
        $post = Post::factory()->create();

        $this->getJson('/api/v1/posts/'.$post->slug)
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'not_found');
    }

    public function test_markdown_is_rendered_server_side_with_raw_html_stripped(): void
    {
        Post::factory()->published()->create([
            'slug' => 'xss-check',
            'body_markdown' => "## Heading\n\n<script>alert(1)</script>\n\nSafe text.",
        ]);

        $response = $this->getJson('/api/v1/posts/xss-check')->assertOk();

        $this->assertStringNotContainsString('<script>', $response->json('data.body_html'));
        $this->assertStringContainsString('<h2>', $response->json('data.body_html'));
    }

    public function test_a_course_without_lessons_is_never_listed(): void
    {
        Course::factory()->published()->create(['title' => 'Empty course']);

        $this->getJson('/api/v1/courses')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_a_published_course_with_a_lesson_is_listed(): void
    {
        $course = Course::factory()->published()->create();
        $section = $course->sections()->create(['title' => 'Module', 'position' => 0]);
        $course->lessons()->create([
            'course_section_id' => $section->id,
            'slug' => 'intro',
            'title' => 'Intro',
            'type' => 'text',
            'position' => 0,
        ]);

        $this->getJson('/api/v1/courses')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_a_legal_page_reports_that_it_is_awaiting_review(): void
    {
        Page::create([
            'slug' => 'terms',
            'title' => 'Terms',
            'body_markdown' => 'Draft terms.',
            'status' => ContentStatus::Published,
            'template' => 'legal',
            'requires_legal_review' => true,
            'legal_reviewed' => false,
            'published_at' => now(),
        ]);

        $this->getJson('/api/v1/pages/terms')
            ->assertOk()
            ->assertJsonPath('data.awaiting_legal_review', true);
    }

    public function test_the_sitemap_feed_only_contains_indexable_content(): void
    {
        Post::factory()->published()->create(['slug' => 'live-article']);
        Post::factory()->create(['slug' => 'draft-article']);

        $response = $this->getJson('/api/v1/site/sitemap')->assertOk();

        $slugs = collect($response->json('data.posts'))->pluck('slug');

        $this->assertTrue($slugs->contains('live-article'));
        $this->assertFalse($slugs->contains('draft-article'));
    }

    public function test_site_settings_omit_values_the_owner_has_not_supplied(): void
    {
        config()->set('nb.site.phone', null);

        $this->getJson('/api/v1/site/settings')
            ->assertOk()
            ->assertJsonPath('data.phone', null)
            ->assertJsonPath('data.currency', 'BDT');
    }

    public function test_search_only_returns_published_records(): void
    {
        Post::factory()->published()->create(['title' => 'Footing design basics']);
        Post::factory()->create(['title' => 'Footing design secrets']);

        $response = $this->getJson('/api/v1/search?q=Footing')->assertOk();

        $this->assertCount(1, $response->json('data.posts'));
    }
}
