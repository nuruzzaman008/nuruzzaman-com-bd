<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use App\Services\Growth\GmailConnection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GrowthGmailTest extends TestCase
{
    use RefreshDatabase;

    private string $url = '/api/v1/admin/growth-hub/gmail';

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['services.google.client_id' => 'test-client', 'services.google.client_secret' => 'test-secret', 'nb.site.url' => 'https://site.example.test']);
    }

    private function owner(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
    }

    private function start(): string
    {
        $url = $this->postJson($this->url.'/connect')->assertOk()->json('data.url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        return $query['state'];
    }

    private function fakeGoogle(): void
    {
        Http::swap((new Factory)->preventStrayRequests());
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'private-access', 'refresh_token' => 'private-refresh', 'scope' => GmailConnection::SCOPE, 'expires_in' => 3600]),
            'gmail.googleapis.com/*' => Http::response(['emailAddress' => 'owner@example.test']),
        ]);
    }

    private function connect(): void
    {
        $this->fakeGoogle();
        $state = $this->start();
        $this->get($this->url.'/callback?state='.$state.'&code=test-code')->assertRedirect('https://site.example.test/dashboard/growth-hub?gmail=connected');
    }

    public function test_existing_auth_role_and_mfa_are_required(): void
    {
        $this->getJson($this->url)->assertUnauthorized();
        $this->actingAs($this->customer())->postJson($this->url.'/connect')->assertForbidden();
        $this->actingAs($this->userWithRole(Role::Admin))->getJson($this->url)->assertForbidden();
        $this->be($this->userWithRole(Role::SuperAdmin));
        $this->getJson($this->url)->assertForbidden();
        $this->getJson($this->url.'/callback?state=x&code=x')->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_password_changed_session_cannot_complete_callback(): void
    {
        $this->owner();
        $state = $this->start();
        $this->withSession(['nb.password_hash' => 'old-password-hash']);
        $this->getJson($this->url.'/callback?state='.$state.'&code=x')->assertUnauthorized();
        Http::assertNothingSent();
        $this->assertDatabaseCount('growth_gmail_connections', 0);
    }

    public function test_gemini_key_does_not_configure_google_oauth(): void
    {
        $this->owner();
        config(['services.google.client_id' => null]);
        $this->getJson($this->url)->assertOk()->assertJsonPath('data.configured', false)->assertJsonPath('data.status', 'disconnected');
        $this->postJson($this->url.'/connect')->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_start_requests_metadata_only_and_pkce(): void
    {
        $this->owner();
        $url = $this->postJson($this->url.'/connect')->assertOk()->json('data.url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);
        $this->assertSame(GmailConnection::SCOPE, $query['scope']);
        $this->assertSame('S256', $query['code_challenge_method']);
        $this->assertSame('https://site.example.test'.$this->url.'/callback', $query['redirect_uri']);
        $this->assertSame('offline', $query['access_type']);
        $this->assertStringNotContainsString('test-secret', $url);
    }

    public function test_callback_without_origin_saves_encrypted_tokens_and_only_safe_status(): void
    {
        $this->owner();
        $this->fakeGoogle();
        $state = $this->start();
        $this->withoutHeader('Origin');
        $this->get($this->url.'/callback?state='.$state.'&code=test-code')->assertRedirectContains('gmail=connected');
        $row = DB::table('growth_gmail_connections')->first();
        $this->assertStringNotContainsString('private-access', $row->credentials);
        $this->assertSame('private-refresh', json_decode(Crypt::decryptString($row->credentials), true)['refresh_token']);
        $this->withHeader('Origin', 'http://localhost');
        $response = $this->getJson($this->url)->assertOk()->assertJsonPath('data.status', 'connected')->assertJsonPath('data.email', 'owner@example.test');
        $this->assertStringNotContainsString('private-access', $response->getContent());
        $this->assertStringNotContainsString('private-refresh', $response->getContent());
        Http::assertSent(fn ($r) => $r->url() === 'https://oauth2.googleapis.com/token' && strlen($r['code_verifier']) === 64);
        $this->assertDatabaseHas('audit_logs', ['action' => 'growth.gmail.connected']);
    }

    public function test_invalid_state_and_replay_are_rejected(): void
    {
        $this->owner();
        $state = $this->start();
        $this->get($this->url.'/callback?state=invalid&code=x')->assertRedirectContains('gmail=failed');
        $this->get($this->url.'/callback?state='.$state.'&code=x')->assertRedirectContains('gmail=failed');
        Http::assertNothingSent();
        $this->assertDatabaseCount('growth_gmail_connections', 0);
    }

    public function test_successful_callback_is_single_use(): void
    {
        $this->owner();
        $this->fakeGoogle();
        $state = $this->start();
        $this->get($this->url.'/callback?state='.$state.'&code=x')->assertRedirectContains('gmail=connected');
        $this->get($this->url.'/callback?state='.$state.'&code=x')->assertRedirectContains('gmail=failed');
        Http::assertSentCount(2);
        $this->assertDatabaseCount('growth_gmail_connections', 1);
    }

    public function test_expired_state_and_changed_user_are_rejected(): void
    {
        $this->owner();
        $state = $this->start();
        $this->travel(11)->minutes();
        $this->get($this->url.'/callback?state='.$state.'&code=x')->assertRedirectContains('gmail=failed');
        $this->travelBack();
        $state = $this->start();
        $this->owner();
        $this->get($this->url.'/callback?state='.$state.'&code=x')->assertRedirectContains('gmail=failed');
        Http::assertNothingSent();
    }

    public function test_denied_consent_and_missing_scope_never_show_connected(): void
    {
        $this->owner();
        $state = $this->start();
        $this->get($this->url.'/callback?state='.$state.'&error=access_denied')->assertRedirectContains('gmail=cancelled');
        Http::assertNothingSent();
        Http::swap((new Factory)->preventStrayRequests());
        Http::fake(['oauth2.googleapis.com/token' => Http::response(['access_token' => 'secret', 'refresh_token' => 'secret', 'scope' => 'openid email'])]);
        $state = $this->start();
        $this->get($this->url.'/callback?state='.$state.'&code=x')->assertRedirectContains('gmail=failed');
        $this->assertDatabaseCount('growth_gmail_connections', 0);
    }

    public function test_expired_access_token_is_refreshed_and_profile_verified(): void
    {
        $this->owner();
        $this->connect();
        $this->travel(2)->hours();
        Http::swap((new Factory)->preventStrayRequests());
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'renewed', 'expires_in' => 3600]),
            'gmail.googleapis.com/*' => Http::response(['emailAddress' => 'owner@example.test']),
        ]);
        $this->postJson($this->url.'/check')->assertOk()->assertJsonPath('data.status', 'connected');
        Http::assertSent(fn ($r) => $r->url() === 'https://oauth2.googleapis.com/token' && $r['grant_type'] === 'refresh_token' && $r['refresh_token'] === 'private-refresh');
    }

    public function test_google_failure_is_safe_and_not_falsely_connected(): void
    {
        $this->owner();
        $this->connect();
        Http::swap((new Factory)->preventStrayRequests());
        Http::fake(['gmail.googleapis.com/*' => Http::response(['error' => 'private-provider-details'], 403)]);
        $r = $this->postJson($this->url.'/check')->assertOk()->assertJsonPath('data.status', 'verification_failed');
        $this->assertStringNotContainsString('private-provider-details', $r->getContent());
    }

    public function test_connections_are_owner_scoped_and_disconnect_removes_credentials(): void
    {
        $this->owner();
        $first = auth()->id();
        $this->connect();
        $this->owner();
        $this->getJson($this->url)->assertOk()->assertJsonPath('data.email', null);
        $this->deleteJson($this->url)->assertOk();
        $this->assertDatabaseHas('growth_gmail_connections', ['user_id' => $first]);
        $this->actingAs(User::findOrFail($first));
        $this->deleteJson($this->url)->assertOk()->assertJsonPath('data.status', 'disconnected');
        $this->assertDatabaseCount('growth_gmail_connections', 0);
        $this->assertDatabaseHas('audit_logs', ['action' => 'growth.gmail.disconnected']);
    }
}
