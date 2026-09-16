<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\ProductType;
use App\Enums\Role;
use App\Models\Post;
use App\Models\SeoMeta;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "New article" and "New product" in the dashboard, and the SEO score the
 * lists show beside each row.
 */
class AdminContentCreationTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_new_article_starts_as_an_empty_draft(): void
    {
        $this->actingAs($this->userWithRole(Role::Editor));

        $response = $this->postJson('/api/v1/admin/posts', [
            'title' => 'Bolt connection checks',
            'slug' => 'bolt-connection-checks',
            // The form asks for a title and an address; the writing happens in
            // the editor that opens next.
            'body_markdown' => '',
        ]);

        $response->assertCreated();
        $this->assertSame('draft', $response->json('data.status'));

        $post = Post::query()->where('slug', 'bolt-connection-checks')->firstOrFail();
        $this->assertSame('', $post->body_markdown);
    }

    public function test_an_article_still_needs_a_title_and_an_address(): void
    {
        $this->actingAs($this->userWithRole(Role::Editor));

        $this->postJson('/api/v1/admin/posts', ['body_markdown' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'slug']);
    }

    public function test_a_new_product_starts_as_a_draft_of_the_kind_chosen(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $response = $this->postJson('/api/v1/admin/products', [
            'name' => 'NB Tools yearly licence',
            'slug' => 'nb-tools-yearly-licence',
            'type' => ProductType::SoftwareLicense->value,
        ]);

        $response->assertCreated();
        $this->assertSame(ContentStatus::Draft->value, $response->json('data.status') ?? ContentStatus::Draft->value);
        $this->assertSame('nb-tools-yearly-licence', $response->json('data.slug'));
    }

    public function test_the_lists_carry_the_seo_row_each_score_is_measured_from(): void
    {
        $post = Post::factory()->published()->create(['slug' => 'footing-punching-shear']);
        SeoMeta::query()->create([
            'seoable_type' => $post->getMorphClass(),
            'seoable_id' => $post->getKey(),
            'meta_title' => 'Punching shear in a footing',
            'meta_description' => 'How to check punching shear in an isolated footing.',
            'focus_keyword' => 'punching shear',
        ]);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->getJson('/api/v1/admin/posts')
            ->assertOk()
            ->assertJsonPath('data.0.seo.focus_keyword', 'punching shear');
    }
}
