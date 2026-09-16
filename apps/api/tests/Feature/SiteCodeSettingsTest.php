<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Jobs\RevalidateFrontend;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Header and footer code saved in the dashboard: Search Console, AdSense,
 * Analytics, ads.txt. The public settings endpoint is how the site reads it.
 */
class SiteCodeSettingsTest extends TestCase
{
    use RefreshDatabase;

    private array $payload = [
        'settings' => [
            ['key' => 'code.head', 'group' => 'code', 'value' => '<meta name="google-site-verification" content="abc" />', 'is_public' => true],
            ['key' => 'code.ads_txt', 'group' => 'code', 'value' => 'google.com, pub-1, DIRECT, f08c47fec0942fa0', 'is_public' => true],
        ],
    ];

    public function test_an_administrator_saves_it_and_the_site_is_refreshed(): void
    {
        Queue::fake();
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->putJson('/api/v1/admin/settings', $this->payload)->assertOk();

        $this->assertSame(
            '<meta name="google-site-verification" content="abc" />',
            Setting::value('code.head'),
        );

        // Saved code that only shows after the next rebuild is not saved code.
        Queue::assertPushed(
            RevalidateFrontend::class,
            fn (RevalidateFrontend $job) => in_array('settings', $job->tags, true),
        );
    }

    public function test_the_public_settings_carry_it_to_the_pages_that_render_it(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->putJson('/api/v1/admin/settings', $this->payload)->assertOk();

        // The keys carry dots, which assertJsonPath would read as nesting.
        $overrides = $this->getJson('/api/v1/site/settings')->assertOk()->json('data.overrides');

        $this->assertSame('<meta name="google-site-verification" content="abc" />', $overrides['code.head']);
        $this->assertSame('google.com, pub-1, DIRECT, f08c47fec0942fa0', $overrides['code.ads_txt']);
    }

    public function test_someone_without_the_permission_cannot_put_code_on_the_site(): void
    {
        $this->actingAs($this->userWithRole(Role::Editor));

        $this->putJson('/api/v1/admin/settings', $this->payload)->assertForbidden();
        $this->assertNull(Setting::value('code.head'));
    }
}
