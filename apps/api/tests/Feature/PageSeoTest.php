<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\Role;
use App\Models\Media;
use App\Models\Page;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A page gets the same SEO tooling as an article: a share image, the robots
 * and canonical options, a score on the list, and the keyword-clash check.
 */
class PageSeoTest extends TestCase
{
    use RefreshDatabase;

    private function page(array $attributes = []): Page
    {
        return Page::create($attributes + [
            'slug' => 'services',
            'title' => 'আমাদের সেবা',
            'body_markdown' => 'স্ট্রাকচারাল ডিজাইন।',
            'status' => ContentStatus::Published,
            'template' => 'default',
            'published_at' => now(),
        ]);
    }

    public function test_a_share_image_and_the_robots_options_are_saved_and_served(): void
    {
        $admin = $this->userWithRole(Role::Admin);
        $page = $this->page();
        $image = Media::factory()->create(['alt_text' => 'Structural design drawings']);

        $this->actingAs($admin)->patchJson("/api/v1/admin/pages/{$page->id}", [
            'seo' => [
                'focus_keyword' => 'structural design',
                'og_media_id' => $image->id,
                'canonical_url' => 'https://nuruzzaman.com.bd/services',
                'noindex' => false,
                'nofollow' => true,
            ],
        ])->assertOk()
            ->assertJsonPath('data.share_image.id', $image->id)
            ->assertJsonPath('data.share_image.alt', 'Structural design drawings')
            ->assertJsonPath('data.seo.nofollow', true)
            ->assertJsonPath('data.seo.canonical_url', 'https://nuruzzaman.com.bd/services');

        // The public page carries the picture for its share card and search result.
        $this->app['auth']->forgetGuards();
        $public = $this->getJson('/api/v1/pages/services')->assertOk();
        $this->assertSame($image->url(), $public->json('data.seo.og_image_url'));
        $this->assertArrayNotHasKey('share_image', $public->json('data'));

        // Taken off again.
        $this->actingAs($admin)->patchJson("/api/v1/admin/pages/{$page->id}", ['seo' => ['og_media_id' => null]])
            ->assertOk()->assertJsonPath('data.share_image', null);
    }

    public function test_an_unknown_share_image_is_refused(): void
    {
        $page = $this->page();

        $this->actingAs($this->userWithRole(Role::Admin))
            ->patchJson("/api/v1/admin/pages/{$page->id}", ['seo' => ['og_media_id' => 999999]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('seo.og_media_id', 'error.fields');
    }

    public function test_the_list_carries_what_the_seo_score_is_worked_out_from(): void
    {
        $page = $this->page();
        $page->seo()->create(['focus_keyword' => 'structural design', 'meta_description' => 'What I design.']);

        $row = collect($this->actingAs($this->userWithRole(Role::Editor))->getJson('/api/v1/admin/pages')->assertOk()->json('data'))
            ->firstWhere('id', $page->id);

        $this->assertSame('structural design', $row['seo']['focus_keyword']);
        $this->assertSame('What I design.', $row['seo']['meta_description']);
        $this->assertSame('স্ট্রাকচারাল ডিজাইন।', $row['body_markdown']);
        $this->assertArrayHasKey('share_image', $row);
    }

    public function test_a_page_translation_is_not_a_keyword_clash_but_another_page_is(): void
    {
        $editor = $this->userWithRole(Role::Editor);
        $bengali = $this->page(['slug' => 'services']);
        $bengali->seo()->create(['focus_keyword' => 'structural design']);
        $english = $this->page(['slug' => 'services-en', 'title' => 'Services']);
        $english->seo()->create(['focus_keyword' => 'structural design']);

        $ask = fn (Page $page) => $this->actingAs($editor)->getJson('/api/v1/admin/seo/keyword-usage?'.http_build_query([
            'keyword' => 'structural design', 'kind' => 'page', 'id' => $page->id,
        ]))->assertOk();

        $ask($bengali)->assertJsonCount(0, 'data.used_by');
        $ask($english)->assertJsonCount(0, 'data.used_by');

        $post = Post::factory()->create(['title' => 'Structural design basics']);
        $post->seo()->create(['focus_keyword' => 'Structural Design']);

        $ask($bengali)->assertJsonCount(1, 'data.used_by')->assertJsonPath('data.used_by.0.title', 'Structural design basics');
    }
}
