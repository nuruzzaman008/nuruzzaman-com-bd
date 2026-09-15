<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Media;
use App\Models\Post;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Finding a file in the media library, and deleting one without breaking a page. */
class AdminMediaLibraryTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_library_is_searched_by_file_name_alt_text_or_caption(): void
    {
        $this->actingAs($this->userWithRole(Role::Admin));

        Media::factory()->create(['original_name' => 'floor-plan-duplex.png', 'alt_text' => 'Ground floor']);
        Media::factory()->create(['original_name' => 'site-photo.jpg', 'alt_text' => 'Column reinforcement on site']);
        Media::factory()->create(['original_name' => 'logo.svg', 'alt_text' => null, 'caption' => 'NB Consultant logo']);

        $names = fn (string $term) => collect(
            $this->getJson('/api/v1/admin/media?q='.urlencode($term))->assertOk()->json('data')
        )->pluck('original_name')->all();

        $this->assertSame(['floor-plan-duplex.png'], $names('DUPLEX'));
        $this->assertSame(['site-photo.jpg'], $names('reinforcement'));
        $this->assertSame(['logo.svg'], $names('consultant'));
        $this->assertSame([], $names('100%'));

        $this->getJson('/api/v1/admin/media')->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.current_page', 1);
    }

    public function test_the_library_is_filtered_by_type_and_upload_month(): void
    {
        $this->actingAs($this->userWithRole(Role::Admin));

        Media::factory()->create(['original_name' => 'plan.png', 'mime_type' => 'image/png', 'created_at' => '2026-08-10 10:00:00']);
        Media::factory()->create(['original_name' => 'boq.pdf', 'mime_type' => 'application/pdf', 'created_at' => '2026-09-02 10:00:00']);
        Media::factory()->create(['original_name' => 'site.webp', 'mime_type' => 'image/webp', 'created_at' => '2026-09-05 10:00:00']);

        $names = fn (string $query) => collect(
            $this->getJson('/api/v1/admin/media?'.$query)->assertOk()->json('data')
        )->pluck('original_name')->sort()->values()->all();

        $this->assertSame(['plan.png', 'site.webp'], $names('type=image'));
        $this->assertSame(['boq.pdf'], $names('type=pdf'));
        $this->assertSame(['boq.pdf', 'site.webp'], $names('month=2026-09'));
        $this->assertSame(['site.webp'], $names('type=image&month=2026-09'));
        // A malformed month is ignored rather than refused.
        $this->assertCount(3, $names('month=September'));

        $this->getJson('/api/v1/admin/media')->assertOk()->assertJsonPath('filters.months', ['2026-09', '2026-08']);
    }

    public function test_an_unused_file_is_deleted_with_its_bytes(): void
    {
        Storage::fake('public');
        $this->actingAs($this->userWithRole(Role::Admin));

        $media = Media::factory()->create(['path' => 'uploads/2026/09/unused.webp']);
        Storage::disk('public')->put($media->path, 'bytes');

        $this->deleteJson("/api/v1/admin/media/{$media->id}")->assertOk();

        $this->assertModelMissing($media);
        Storage::disk('public')->assertMissing('uploads/2026/09/unused.webp');
    }

    public function test_a_file_in_use_is_kept_until_the_admin_confirms(): void
    {
        Storage::fake('public');
        $this->actingAs($this->userWithRole(Role::Admin));

        $cover = Media::factory()->create(['path' => 'uploads/2026/09/cover.webp']);
        $diagram = Media::factory()->create(['path' => 'uploads/2026/09/beam_diagram.png']);
        Storage::disk('public')->put($cover->path, 'bytes');

        $product = Product::factory()->create(['name' => 'NB Engineering Tools', 'cover_media_id' => $cover->id]);
        Post::factory()->create([
            'title' => 'Beam design guide',
            'body_markdown' => "Intro\n\n![Beam](https://api.nuruzzaman.com.bd/storage/uploads/2026/09/beam_diagram.png)",
        ]);

        $this->deleteJson("/api/v1/admin/media/{$cover->id}")
            ->assertStatus(409)
            ->assertJsonPath('error.message', fn (string $message) => str_contains($message, 'Product “NB Engineering Tools”'));
        $this->assertModelExists($cover);
        Storage::disk('public')->assertExists($cover->path);

        // Written into an article's text rather than picked as a cover.
        $this->deleteJson("/api/v1/admin/media/{$diagram->id}")
            ->assertStatus(409)
            ->assertJsonPath('error.message', fn (string $message) => str_contains($message, 'Article “Beam design guide”'));

        $this->deleteJson("/api/v1/admin/media/{$cover->id}?force=1")->assertOk();
        $this->assertModelMissing($cover);
        Storage::disk('public')->assertMissing('uploads/2026/09/cover.webp');
        $this->assertNull($product->fresh()->cover_media_id);
    }

    public function test_customers_cannot_search_or_delete_media(): void
    {
        $media = Media::factory()->create();

        $this->actingAs($this->customer());
        $this->getJson('/api/v1/admin/media?q=example')->assertForbidden();
        $this->deleteJson("/api/v1/admin/media/{$media->id}?force=1")->assertForbidden();

        $this->assertModelExists($media);
    }
}
