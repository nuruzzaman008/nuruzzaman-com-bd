<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\Media;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Uploading an image into the media library.
 *
 * The endpoint predates the dashboard's upload button, and nothing tested it
 * until that button came to depend on it. The button sends what the browser
 * produces - usually a WebP, resized to fit the host's 2 MB PHP limit - with
 * the alt text the admin typed, then selects the returned id as a product's
 * featured image. Each step of that is held to here.
 */
class AdminMediaUploadTest extends TestCase
{
    use RefreshDatabase;

    /** Real bytes, so the MIME check reads the file rather than a claimed type. */
    private const WEBP_1PX = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

    private const GIF_1PX = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    private function webp(string $name = 'cover.webp'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, base64_decode(self::WEBP_1PX));
    }

    public function test_an_admin_uploads_a_webp_with_its_alt_text(): void
    {
        Storage::fake('public');
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);

        $response = $this->actingAs($admin)
            ->postJson('/api/v1/admin/media', [
                'file' => $this->webp(),
                'alt_text' => 'NB Engineering Tools ribbon in AutoCAD',
            ])
            ->assertCreated()
            ->assertJsonPath('data.mime_type', 'image/webp')
            ->assertJsonPath('data.alt_text', 'NB Engineering Tools ribbon in AutoCAD')
            ->assertJsonPath('data.original_name', 'cover.webp');

        $medium = Media::findOrFail($response->json('data.id'));

        // The editor previews this URL the moment the upload returns, so it has
        // to be the public one, not a path.
        $this->assertStringContainsString('/storage/uploads/', (string) $response->json('data.url'));

        Storage::disk('public')->assertExists($medium->path);
        // Stored under a generated name, never the one the browser sent.
        $this->assertStringNotContainsString('cover', basename($medium->path));
    }

    public function test_the_upload_becomes_a_products_featured_image(): void
    {
        Storage::fake('public');
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);
        $product = Product::factory()->create(['cover_media_id' => null]);

        $upload = $this->actingAs($admin)
            ->postJson('/api/v1/admin/media', ['file' => $this->webp(), 'alt_text' => 'Cover'])
            ->assertCreated();

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/products/'.$product->id, ['cover_media_id' => $upload->json('data.id')])
            ->assertOk()
            ->assertJsonPath('data.cover_url', $upload->json('data.url'))
            ->assertJsonPath('data.cover_alt', 'Cover');

        $this->assertSame($upload->json('data.id'), $product->fresh()->cover_media_id);
    }

    public function test_alt_text_may_be_left_out(): void
    {
        Storage::fake('public');
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);

        // The button sends none when the admin clears the description.
        $this->actingAs($admin)
            ->postJson('/api/v1/admin/media', ['file' => $this->webp()])
            ->assertCreated()
            ->assertJsonPath('data.alt_text', null);
    }

    public function test_a_type_outside_the_allowed_list_is_refused(): void
    {
        Storage::fake('public');
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);

        $gif = UploadedFile::fake()->createWithContent('animation.gif', base64_decode(self::GIF_1PX));

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/media', ['file' => $gif])
            ->assertStatus(422)
            ->assertJsonPath('error.fields.file.0', fn (string $message) => $message !== '');

        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_staff_without_media_manage_cannot_upload(): void
    {
        Storage::fake('public');
        $this->seedRoles();
        // Support can open a product (products.view) but holds no media.manage,
        // which is exactly who the editor hides the upload button from.
        $support = $this->userWithRole(RoleEnum::Support);

        $this->actingAs($support)
            ->postJson('/api/v1/admin/media', ['file' => $this->webp()])
            ->assertForbidden();

        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertSame(0, Media::query()->count());
    }
}
