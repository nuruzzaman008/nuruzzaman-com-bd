<?php

namespace Tests\Feature;

use App\Models\DownloadAsset;
use App\Models\DownloadEntitlement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DownloadEntitlementTest extends TestCase
{
    use RefreshDatabase;

    private DownloadAsset $asset;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('private');
        config()->set('nb.downloads.disk', 'private');

        Storage::disk('private')->put('releases/installer.exe', 'binary-contents');

        $this->asset = DownloadAsset::create([
            'slug' => 'nb-installer',
            'name' => 'Installer',
            'disk' => 'private',
            'storage_path' => 'releases/installer.exe',
            'checksum_sha256' => hash('sha256', 'binary-contents'),
            'is_available' => true,
        ]);
    }

    private function entitle(User $user, array $overrides = []): DownloadEntitlement
    {
        return DownloadEntitlement::create(array_merge([
            'user_id' => $user->getKey(),
            'download_asset_id' => $this->asset->getKey(),
            'max_downloads' => 3,
        ], $overrides));
    }

    public function test_an_entitled_customer_can_download(): void
    {
        $user = $this->customer();
        $entitlement = $this->entitle($user);

        $this->actingAs($user)
            ->post('/api/v1/account/downloads/nb-installer')
            ->assertOk();

        $this->assertSame(1, $entitlement->fresh()->download_count);
        $this->assertDatabaseHas('download_events', ['outcome' => 'granted']);
    }

    public function test_a_customer_without_an_entitlement_is_refused(): void
    {
        $user = $this->customer();

        $this->actingAs($user)
            ->postJson('/api/v1/account/downloads/nb-installer')
            ->assertStatus(403);
    }

    public function test_a_revoked_entitlement_is_refused_and_logged(): void
    {
        $user = $this->customer();
        $this->entitle($user, ['revoked_at' => now(), 'revoked_reason' => 'Refunded']);

        $this->actingAs($user)
            ->postJson('/api/v1/account/downloads/nb-installer')
            ->assertStatus(403);

        $this->assertDatabaseHas('download_events', ['outcome' => 'revoked']);
    }

    public function test_an_expired_entitlement_is_refused(): void
    {
        $user = $this->customer();
        $this->entitle($user, ['expires_at' => now()->subDay()]);

        $this->actingAs($user)
            ->postJson('/api/v1/account/downloads/nb-installer')
            ->assertStatus(403);

        $this->assertDatabaseHas('download_events', ['outcome' => 'expired']);
    }

    public function test_the_download_limit_is_enforced(): void
    {
        $user = $this->customer();
        $this->entitle($user, ['max_downloads' => 1]);

        $this->actingAs($user)->post('/api/v1/account/downloads/nb-installer')->assertOk();

        $this->actingAs($user)
            ->postJson('/api/v1/account/downloads/nb-installer')
            ->assertStatus(403);

        $this->assertDatabaseHas('download_events', ['outcome' => 'limit_reached']);
    }

    public function test_an_asset_without_a_stored_file_is_unavailable(): void
    {
        $user = $this->customer();
        $this->entitle($user);
        $this->asset->update(['storage_path' => null]);

        $this->actingAs($user)
            ->postJson('/api/v1/account/downloads/nb-installer')
            ->assertStatus(503);
    }

    public function test_the_private_storage_path_is_never_serialised(): void
    {
        $user = $this->customer();
        $this->entitle($user);

        $response = $this->actingAs($user)->getJson('/api/v1/account/downloads')->assertOk();

        $this->assertStringNotContainsString('releases/installer.exe', $response->getContent());
        $response->assertJsonPath('data.0.asset.checksum_sha256', hash('sha256', 'binary-contents'));
    }
}
