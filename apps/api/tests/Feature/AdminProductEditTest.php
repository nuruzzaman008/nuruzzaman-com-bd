<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\Media;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Editing a product from the dashboard.
 *
 * The catalogue has been editable through the API since it was written, but
 * nothing exercised PATCH with an `seo` key until the dashboard grew a form
 * that sends one - at which point the endpoint answered 500.
 */
class AdminProductEditTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_admin_can_rewrite_a_products_copy(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $product = Product::factory()->create([
            'slug' => 'old-slug',
            'name' => 'Old name',
            'description_markdown' => 'Old body.',
        ]);

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/products/'.$product->id, [
                'name' => 'New name',
                'slug' => 'new-slug',
                'tagline' => 'A new tagline.',
                'description_markdown' => '## New body',
                'is_price_public' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'New name');

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'slug' => 'new-slug',
            'name' => 'New name',
            'description_markdown' => '## New body',
            'is_price_public' => false,
        ]);
    }

    public function test_saving_the_seo_panel_does_not_error(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $product = Product::factory()->create();

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/products/'.$product->id, [
                'seo' => [
                    'meta_title' => 'A title worth clicking',
                    'meta_description' => 'A description that says what the page is about.',
                    'focus_keyword' => 'engineering software',
                    'noindex' => false,
                ],
            ])
            ->assertOk();

        $this->assertDatabaseHas('seo_meta', [
            'meta_title' => 'A title worth clicking',
            'focus_keyword' => 'engineering software',
        ]);
    }

    public function test_the_indexing_controls_round_trip(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $product = Product::factory()->create();

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/products/'.$product->id, [
                'seo' => [
                    'canonical_url' => 'https://example.org/original',
                    'noindex' => true,
                    'nofollow' => true,
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.seo.noindex', true)
            ->assertJsonPath('data.seo.canonical_url', 'https://example.org/original');

        // Putting a page back into the index has to work as well as taking it
        // out; a checkbox that only ever travels one way is a trap.
        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/products/'.$product->id, [
                'seo' => ['canonical_url' => null, 'noindex' => false, 'nofollow' => false],
            ])
            ->assertOk()
            ->assertJsonPath('data.seo.noindex', false)
            ->assertJsonPath('data.seo.canonical_url', null);
    }

    public function test_a_featured_image_can_be_attached_and_removed(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $product = Product::factory()->create(['cover_media_id' => null]);
        $medium = Media::factory()->create();

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/products/'.$product->id, ['cover_media_id' => $medium->id])
            ->assertOk();

        $this->assertSame($medium->id, $product->fresh()->cover_media_id);

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/products/'.$product->id, ['cover_media_id' => null])
            ->assertOk();

        $this->assertNull($product->fresh()->cover_media_id);
    }

    public function test_the_editor_is_given_the_markdown_source_not_its_rendering(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $product = Product::factory()->create(['description_markdown' => '## A heading']);

        // Loading the rendered HTML into the form would save the rendering back
        // over its own source, and the next edit would render the rendering.
        $this->actingAs($admin)
            ->getJson('/api/v1/admin/products/'.$product->id)
            ->assertOk()
            ->assertJsonPath('data.description_markdown', '## A heading');
    }

    public function test_a_customer_is_never_shown_the_editable_fields(): void
    {
        $product = Product::factory()->create();

        $response = $this->getJson('/api/v1/products/'.$product->slug)->assertOk();

        $response->assertJsonMissingPath('data.description_markdown');
        $response->assertJsonMissingPath('data.cover_media_id');
    }

    public function test_a_slug_that_belongs_to_another_product_is_refused(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        Product::factory()->create(['slug' => 'taken']);
        $product = Product::factory()->create(['slug' => 'mine']);

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/products/'.$product->id, ['slug' => 'taken'])
            ->assertStatus(422)
            ->assertJsonPath('error.fields.slug.0', fn (string $message) => $message !== '');
    }

    public function test_an_editor_without_the_commerce_permission_cannot_edit_the_catalogue(): void
    {
        $this->seedRoles();
        $editor = $this->userWithRole(RoleEnum::Editor);
        $product = Product::factory()->create(['name' => 'Untouched']);

        $this->actingAs($editor)
            ->patchJson('/api/v1/admin/products/'.$product->id, ['name' => 'Changed'])
            ->assertForbidden();

        $this->assertSame('Untouched', $product->fresh()->name);
    }
}
