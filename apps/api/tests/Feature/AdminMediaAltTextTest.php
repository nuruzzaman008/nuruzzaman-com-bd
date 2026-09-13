<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\Media;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Rewriting an image's alt text after it has been uploaded.
 *
 * The product editor's description field writes here when an existing
 * featured image's description is changed - and the SEO analysis now fails a
 * featured image without one, so this is the only way that failure can be
 * fixed short of uploading the same picture again.
 */
class AdminMediaAltTextTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_admin_describes_an_existing_image(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $medium = Media::factory()->create(['alt_text' => null]);

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/media/'.$medium->id, [
                'alt_text' => 'NB Engineering Tools ribbon in AutoCAD',
            ])
            ->assertOk()
            ->assertJsonPath('data.alt_text', 'NB Engineering Tools ribbon in AutoCAD');

        $this->assertSame('NB Engineering Tools ribbon in AutoCAD', $medium->fresh()->alt_text);
    }

    public function test_the_new_description_reaches_the_product_that_uses_the_image(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $medium = Media::factory()->create(['alt_text' => 'Old description']);
        $product = Product::factory()->create(['cover_media_id' => $medium->id]);

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/media/'.$medium->id, ['alt_text' => 'New description'])
            ->assertOk();

        // The SEO page reads cover_alt off the product; it must not be stale.
        $this->actingAs($admin)
            ->getJson('/api/v1/admin/products/'.$product->id)
            ->assertOk()
            ->assertJsonPath('data.cover_alt', 'New description');
    }

    public function test_a_description_can_be_cleared(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $medium = Media::factory()->create(['alt_text' => 'Something']);

        // The editor sends null for an emptied field, not an empty string.
        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/media/'.$medium->id, ['alt_text' => null])
            ->assertOk()
            ->assertJsonPath('data.alt_text', null);
    }

    public function test_an_overlong_description_is_refused(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $medium = Media::factory()->create(['alt_text' => 'Kept']);

        // The editor's field stops at 255; the API has to hold the same line.
        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/media/'.$medium->id, ['alt_text' => str_repeat('a', 256)])
            ->assertStatus(422);

        $this->assertSame('Kept', $medium->fresh()->alt_text);
    }

    public function test_staff_without_media_manage_cannot_rewrite_a_description(): void
    {
        $this->seedRoles();
        $support = $this->userWithRole(RoleEnum::Support);
        $medium = Media::factory()->create(['alt_text' => 'Kept']);

        $this->actingAs($support)
            ->patchJson('/api/v1/admin/media/'.$medium->id, ['alt_text' => 'Changed'])
            ->assertForbidden();

        $this->assertSame('Kept', $medium->fresh()->alt_text);
    }
}
