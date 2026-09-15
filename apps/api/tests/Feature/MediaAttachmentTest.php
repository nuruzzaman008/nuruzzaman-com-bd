<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Media;
use App\Models\Product;
use App\Models\SeoMeta;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** The media library's attachment details, image editing, videos and attachment pages. */
class MediaAttachmentTest extends TestCase
{
    use RefreshDatabase;

    /** A real PNG, half red, so GD has pixels to turn. */
    private function png(int $width, int $height): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagefilledrectangle($image, 0, 0, intdiv($width, 2), $height, imagecolorallocate($image, 200, 30, 30));

        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    public function test_details_name_where_a_file_is_used_and_offer_its_focus_keyword(): void
    {
        $admin = $this->userWithRole(Role::Admin, ['name' => 'Fatema']);
        $this->actingAs($admin);

        $media = Media::factory()->create(['uploaded_by' => $admin->id, 'original_name' => 'six-storey.jpg']);
        $product = Product::factory()->create(['name' => 'Six Storey Building', 'cover_media_id' => $media->id]);
        SeoMeta::create([
            'seoable_type' => $product->getMorphClass(),
            'seoable_id' => $product->id,
            'focus_keyword' => 'six storey building design',
        ]);

        $this->patchJson("/api/v1/admin/media/{$media->id}", [
            'title' => 'Design example of a six storey building',
            'description' => 'Day view of the front elevation.',
            'exclude_from_sitemap' => true,
        ])->assertOk()
            ->assertJsonPath('data.title', 'Design example of a six storey building')
            ->assertJsonPath('data.description', 'Day view of the front elevation.')
            ->assertJsonPath('data.exclude_from_sitemap', true);

        $this->getJson("/api/v1/admin/media/{$media->id}")->assertOk()
            ->assertJsonPath('data.uploaded_by.name', 'Fatema')
            ->assertJsonPath('data.used_in.0.title', 'Six Storey Building')
            ->assertJsonPath('data.used_in.0.edit_path', "/dashboard/products/{$product->id}")
            ->assertJsonPath('data.focus_keywords.0.keyword', 'six storey building design')
            ->assertJsonPath('data.focus_keywords.0.source', 'Product “Six Storey Building”')
            ->assertJsonPath('data.attachment_path', "/attachment/{$media->id}");
    }

    public function test_a_video_is_uploaded_with_its_length_and_titled_from_its_name(): void
    {
        Storage::fake('public');
        $this->actingAs($this->userWithRole(Role::Admin));

        $this->postJson('/api/v1/admin/media', [
            'file' => UploadedFile::fake()->create('Modern-triplex-walkthrough.mp4', 4096, 'video/mp4'),
            'duration_seconds' => 253,
        ])->assertCreated()
            ->assertJsonPath('data.mime_type', 'video/mp4')
            ->assertJsonPath('data.duration_seconds', 253)
            ->assertJsonPath('data.title', 'Modern-triplex-walkthrough')
            ->assertJsonPath('data.editable', false);

        Storage::disk('public')->assertExists(Media::query()->sole()->path);

        // Still nothing a browser would run.
        $this->postJson('/api/v1/admin/media', [
            'file' => UploadedFile::fake()->create('setup.exe', 10, 'application/x-msdownload'),
        ])->assertUnprocessable();
        $this->assertSame(1, Media::query()->count());
    }

    public function test_an_image_is_edited_in_place_and_can_be_restored(): void
    {
        Storage::fake('public');
        $this->actingAs($this->userWithRole(Role::Admin));

        Storage::disk('public')->put('uploads/2026/09/plan.png', $this->png(40, 20));
        $media = Media::factory()->create([
            'path' => 'uploads/2026/09/plan.png',
            'mime_type' => 'image/png',
            'width' => 40,
            'height' => 20,
        ]);

        // Turned to 20 x 40, cropped to 20 x 30, scaled to 10 wide.
        $this->postJson("/api/v1/admin/media/{$media->id}/edit", [
            'rotate' => 90,
            'crop' => ['x' => 0, 'y' => 0, 'width' => 20, 'height' => 30],
            'scale_width' => 10,
        ])->assertOk()
            ->assertJsonPath('data.width', 10)
            ->assertJsonPath('data.height', 15)
            ->assertJsonPath('data.edited', true);

        $media->refresh();
        $this->assertSame('uploads/2026/09/plan.png', $media->path, 'Edited in place, so pages using it keep working.');
        $this->assertSame([10, 15], array_slice(getimagesizefromstring(Storage::disk('public')->get($media->path)), 0, 2));
        Storage::disk('public')->assertExists($media->original_path);
        $this->assertStringContainsString('?v=', (string) $media->url());

        $this->postJson("/api/v1/admin/media/{$media->id}/edit", [
            'rotate' => 0,
            'crop' => ['x' => 5, 'y' => 0, 'width' => 10, 'height' => 15],
        ])->assertUnprocessable();

        $this->postJson("/api/v1/admin/media/{$media->id}/edit", ['rotate' => 0])->assertUnprocessable();

        $this->postJson("/api/v1/admin/media/{$media->id}/restore")->assertOk()
            ->assertJsonPath('data.width', 40)
            ->assertJsonPath('data.height', 20)
            ->assertJsonPath('data.edited', false);
        Storage::disk('public')->assertMissing("uploads/originals/{$media->id}-plan.png");
        $this->postJson("/api/v1/admin/media/{$media->id}/restore")->assertStatus(409);

        $pdf = Media::factory()->create(['mime_type' => 'application/pdf']);
        $this->postJson("/api/v1/admin/media/{$pdf->id}/edit", ['rotate' => 90])->assertUnprocessable();
    }

    public function test_an_attachment_page_is_public_and_the_sitemap_leaves_out_excluded_files(): void
    {
        $listed = Media::factory()->create(['title' => 'Duplex floor plan']);
        $hidden = Media::factory()->create(['exclude_from_sitemap' => true]);
        $private = Media::factory()->create(['disk' => 'private']);

        $this->getJson("/api/v1/media/{$listed->id}")->assertOk()
            ->assertJsonPath('data.title', 'Duplex floor plan');
        $this->getJson("/api/v1/media/{$hidden->id}")->assertOk();
        $this->getJson("/api/v1/media/{$private->id}")->assertNotFound();

        $listedIds = collect($this->getJson('/api/v1/site/sitemap')->assertOk()->json('data.attachments'))
            ->pluck('slug')
            ->all();

        $this->assertContains((string) $listed->id, $listedIds);
        $this->assertNotContains((string) $hidden->id, $listedIds);
        $this->assertNotContains((string) $private->id, $listedIds);
    }

    public function test_customers_cannot_see_edit_or_restore_media(): void
    {
        $media = Media::factory()->create(['mime_type' => 'image/png']);

        $this->actingAs($this->customer());
        $this->getJson("/api/v1/admin/media/{$media->id}")->assertForbidden();
        $this->postJson("/api/v1/admin/media/{$media->id}/edit", ['rotate' => 90])->assertForbidden();
        $this->postJson("/api/v1/admin/media/{$media->id}/restore")->assertForbidden();
    }
}
