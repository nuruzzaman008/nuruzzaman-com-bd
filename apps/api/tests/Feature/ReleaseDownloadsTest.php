<?php

namespace Tests\Feature;

use App\Enums\ProductType;
use App\Enums\Role;
use App\Models\DownloadAsset;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Software installers uploaded from the dashboard and handed to buyers after payment. */
class ReleaseDownloadsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('private');
    }

    private function release(string $slug, string $version = '6.0'): int
    {
        return $this->postJson('/api/v1/admin/download-assets', [
            'slug' => $slug,
            'name' => 'NB Engineering Tools — '.$slug,
            'version' => $version,
        ])->assertCreated()->json('data.id');
    }

    /** Sends a file's bytes the way the dashboard does: in parts, then names them. */
    private function sendInParts(string $contents): array
    {
        $uploadId = (string) Str::uuid();
        $parts = str_split($contents, max(1, intdiv(strlen($contents), 3)));

        foreach ($parts as $index => $part) {
            $this->post('/api/v1/admin/uploads/chunks', [
                'upload_id' => $uploadId,
                'index' => $index,
                'chunk' => UploadedFile::fake()->createWithContent($index.'.part', $part),
            ], ['Accept' => 'application/json'])->assertCreated();
        }

        return ['upload_id' => $uploadId, 'total' => count($parts)];
    }

    public function test_an_installer_sent_in_parts_is_stored_privately_with_its_checksum(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $id = $this->release('nb-engineering-tools-autocad-2025');
        $contents = 'MZ'.str_repeat('installer-bytes-', 500);

        $this->postJson("/api/v1/admin/download-assets/{$id}/file", $this->sendInParts($contents) + [
            'filename' => 'NB_Tools_2025_Setup.exe',
        ])->assertOk()
            ->assertJsonPath('data.original_filename', 'NB_Tools_2025_Setup.exe')
            ->assertJsonPath('data.checksum_sha256', hash('sha256', $contents));

        $asset = DownloadAsset::findOrFail($id);
        $this->assertStringEndsWith('.exe', $asset->storage_path);
        $this->assertSame($contents, Storage::disk('private')->get($asset->storage_path));
        $this->assertSame(strlen($contents), $asset->size_bytes);
        // The parts are gone once joined.
        $this->assertSame([], Storage::disk('private')->allFiles('upload-chunks'));
    }

    public function test_only_an_installer_is_accepted(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $id = $this->release('nb-engineering-tools-autocad-2024');

        $this->post("/api/v1/admin/download-assets/{$id}/file", [
            'file' => UploadedFile::fake()->create('notes.pdf', 4),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file', 'error.fields');
        $this->assertNull(DownloadAsset::findOrFail($id)->storage_path);

        $this->post("/api/v1/admin/download-assets/{$id}/file", [
            'file' => UploadedFile::fake()->create('Setup.exe', 4),
        ], ['Accept' => 'application/json'])->assertOk();
    }

    public function test_a_new_installer_replaces_the_old_file(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $id = $this->release('nb-engineering-tools-autocad-2026');

        $this->post("/api/v1/admin/download-assets/{$id}/file", ['file' => UploadedFile::fake()->create('Setup.exe', 4)], ['Accept' => 'application/json'])->assertOk();
        $first = DownloadAsset::findOrFail($id)->storage_path;

        $this->patchJson("/api/v1/admin/download-assets/{$id}", ['version' => '6.1'])->assertOk();
        $this->post("/api/v1/admin/download-assets/{$id}/file", ['file' => UploadedFile::fake()->create('Setup.exe', 8)], ['Accept' => 'application/json'])->assertOk();
        $second = DownloadAsset::findOrFail($id)->storage_path;

        $this->assertNotSame($first, $second);
        Storage::disk('private')->assertMissing($first);
        Storage::disk('private')->assertExists($second);
    }

    public function test_every_licence_chosen_gives_the_buyer_all_four_installers(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $product = Product::factory()->ofType(ProductType::SoftwareLicense)->create(['slug' => 'nb-engineering-tools']);
        $licences = collect([1 => 'NBET-V6-SINGLE', 3 => 'NBET-V6-OFFICE-3', 5 => 'NBET-V6-OFFICE-5'])
            ->map(fn (string $sku, int $devices) => ProductVariant::factory()->for($product)->create(['sku' => $sku, 'device_limit' => $devices]));
        $ids = $licences->pluck('id')->values()->all();

        $assets = collect([2024, 2025, 2026, 2027])->map(function (int $year) use ($ids) {
            $asset = DownloadAsset::create([
                'slug' => 'nb-engineering-tools-autocad-'.$year,
                'name' => 'NB Engineering Tools — AutoCAD '.$year,
                'disk' => 'private',
                'storage_path' => "releases/autocad-{$year}.exe",
                'is_available' => true,
            ]);
            $this->putJson("/api/v1/admin/download-assets/{$asset->id}/variants", ['variant_ids' => $ids])->assertOk();

            return $asset;
        });

        $listed = collect($this->getJson('/api/v1/admin/download-assets')->assertOk()->json('data'));
        $this->assertEqualsCanonicalizing($ids, $listed->firstWhere('slug', 'nb-engineering-tools-autocad-2025')['variant_ids']);

        // An office-pack buyer gets every installer.
        $buyer = $this->customer();
        $office = $licences[3];
        $order = Order::factory()->for($buyer)->paid()->create();
        $order->items()->create([
            'product_variant_id' => $office->id,
            'product_type' => ProductType::SoftwareLicense->value,
            'product_name' => $product->name,
            'variant_name' => $office->name,
            'sku' => $office->sku,
            'quantity' => 1,
            'unit_price_minor' => 1990000,
            'line_total_minor' => 1990000,
            'fulfillment_meta' => ['device_limit' => 3],
        ]);
        app(FulfillmentService::class)->fulfill($order->fresh(['items.variant.product', 'user']));

        $this->assertEqualsCanonicalizing(
            $assets->pluck('id')->all(),
            User::findOrFail($buyer->id)->downloadEntitlements()->pluck('download_asset_id')->all(),
        );
    }

    public function test_customers_cannot_manage_releases(): void
    {
        $asset = DownloadAsset::create(['slug' => 'installer', 'name' => 'Installer', 'disk' => 'private']);
        $variant = ProductVariant::factory()->for(Product::factory()->ofType(ProductType::SoftwareLicense))->create();

        $this->actingAs($this->customer());
        $this->postJson('/api/v1/admin/download-assets', ['slug' => 'x', 'name' => 'X'])->assertForbidden();
        $this->putJson("/api/v1/admin/download-assets/{$asset->id}/variants", ['variant_ids' => [$variant->id]])->assertForbidden();
        $this->post("/api/v1/admin/download-assets/{$asset->id}/file", ['file' => UploadedFile::fake()->create('Setup.exe', 4)], ['Accept' => 'application/json'])->assertForbidden();

        $this->assertSame(0, $asset->variants()->count());
        $this->assertNull($asset->fresh()->storage_path);
    }
}
