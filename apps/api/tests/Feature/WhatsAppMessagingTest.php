<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Services\WhatsApp\WhatsAppMessaging;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class WhatsAppMessagingTest extends TestCase
{
    use RefreshDatabase;

    private string $base = '/api/v1/admin/whatsapp';

    private function contact(array $extra = []): int
    {
        return DB::table('wa_contacts')->insertGetId($extra + ['phone' => '8801812345678', 'name' => 'Contact', 'opt_in' => true, 'consent_source' => 'Written consent', 'created_at' => now(), 'updated_at' => now()]);
    }

    private function connect(bool $campaign = false): void
    {
        DB::table('wa_settings')->where('id', 1)->update(['enabled' => true, 'campaign_enabled' => $campaign, 'test_received' => $campaign,
            'access_token' => Crypt::encryptString('test-meta-token'), 'app_secret' => Crypt::encryptString('test-app-secret'), 'verify_token' => Crypt::encryptString('long-test-verification-token')]);
    }

    private function event(array $messages = [], array $statuses = [], string $waba = '1569882861085596'): array
    {
        return ['object' => 'whatsapp_business_account', 'entry' => [['id' => $waba, 'changes' => [['field' => 'messages', 'value' => [
            'metadata' => ['phone_number_id' => '1312758371929461'], 'messages' => $messages, 'statuses' => $statuses,
        ]]]]]];
    }

    private function webhook(array $payload, string $secret = 'test-app-secret'): TestResponse
    {
        $json = json_encode($payload);

        return $this->call('POST', '/api/v1/whatsapp/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_HUB_SIGNATURE_256' => 'sha256='.hash_hmac('sha256', $json, $secret)], $json);
    }

    public function test_inbox_requires_verified_admin_and_mfa_and_settings_require_super_admin(): void
    {
        $this->getJson($this->base.'/overview')->assertUnauthorized();
        $this->actingAs($this->customer())->getJson($this->base.'/overview')->assertForbidden();
        $admin = $this->userWithRole(Role::Admin);
        $this->be($admin)->getJson($this->base.'/overview')->assertForbidden();
        $this->actingAs($admin)->getJson($this->base.'/overview')->assertOk()->assertJsonPath('data.remaining', 50);
        $this->putJson($this->base.'/settings', [])->assertForbidden();
    }

    public function test_only_super_admin_can_store_encrypted_secrets_and_cannot_expose_them(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->putJson($this->base.'/settings', ['enabled' => true, 'campaign_enabled' => false, 'test_received' => false, 'daily_limit' => 50,
            'access_token' => 'private-test-token', 'app_secret' => 'private-app-secret', 'verify_token' => 'long-verification-token'])->assertOk()->assertJsonMissing(['access_token' => 'private-test-token']);
        $stored = DB::table('wa_settings')->find(1)->access_token;
        $this->assertNotSame('private-test-token', $stored);
        $this->assertSame('private-test-token', Crypt::decryptString($stored));
        $this->assertStringNotContainsString('private-test-token', $this->getJson($this->base.'/overview')->getContent());
        $this->putJson($this->base.'/settings', ['enabled' => true, 'campaign_enabled' => true, 'test_received' => false, 'daily_limit' => 50])->assertUnprocessable();
        $this->putJson($this->base.'/settings', ['enabled' => true, 'campaign_enabled' => false, 'test_received' => false, 'daily_limit' => 51])->assertUnprocessable();
    }

    public function test_signed_webhook_deduplicates_inbound_and_stop_opts_out_without_granting_consent(): void
    {
        $this->connect();
        $payload = $this->event([['id' => 'wamid.inbound', 'from' => '8801812345678', 'timestamp' => (string) now()->timestamp, 'type' => 'text', 'text' => ['body' => 'STOP']]]);
        $this->webhook($payload, 'wrong-secret')->assertForbidden();
        $this->webhook($payload)->assertOk();
        $this->webhook($payload)->assertOk();
        $this->assertDatabaseCount('wa_messages', 1);
        $this->assertDatabaseHas('wa_contacts', ['phone' => '8801812345678', 'unread' => 1, 'opt_in' => false, 'opt_out' => true]);
        $this->webhook($this->event([['id' => 'foreign', 'from' => '8801712345678', 'type' => 'text', 'text' => ['body' => 'wrong WABA']]], [], 'other'))->assertOk();
        $this->assertDatabaseCount('wa_messages', 1);
    }

    public function test_delivery_events_do_not_regress_read_status_or_duplicate_history(): void
    {
        $this->connect();
        $id = $this->contact();
        DB::table('wa_messages')->insert(['contact_id' => $id, 'wa_id' => 'wamid.out', 'direction' => 'outbound', 'kind' => 'template', 'mode' => 'campaign', 'status' => 'accepted', 'occurred_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        foreach (['read', 'delivered', 'sent', 'read'] as $status) {
            $this->webhook($this->event([], [['id' => 'wamid.out', 'status' => $status, 'timestamp' => now()->timestamp, 'recipient_id' => '8801812345678']]))->assertOk();
        }
        $this->assertDatabaseHas('wa_messages', ['wa_id' => 'wamid.out', 'status' => 'read']);
        $this->assertDatabaseCount('wa_messages', 1);
        $this->assertDatabaseCount('wa_status_events', 3);
    }

    public function test_test_sends_exact_approved_template_once_per_request_key_and_does_not_count_campaign(): void
    {
        Http::preventStrayRequests();
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.test', 'message_status' => 'accepted']]])]);
        $this->connect();
        $this->actingAs($this->userWithRole(Role::Admin));
        $id = $this->contact(['phone' => '8801711945113']);
        $body = ['client_key' => (string) Str::uuid(), 'kind' => 'template', 'test' => true, 'template' => 'nbconsultant_intro_v1'];
        $this->postJson($this->base.'/contacts/'.$id.'/send', $body)->assertOk()->assertJsonPath('data.status', 'accepted');
        $this->postJson($this->base.'/contacts/'.$id.'/send', $body)->assertOk();
        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => $r['to'] === '8801711945113' && $r['template'] === ['name' => 'nbconsultant_intro_v1', 'language' => ['code' => 'bn']]);
        $this->assertSame(50, app(WhatsAppMessaging::class)->quota(app(WhatsAppMessaging::class)->settings()));
        $this->postJson($this->base.'/contacts/'.$id.'/send', ['client_key' => (string) Str::uuid(), 'kind' => 'template', 'template' => 'hello_world'])->assertUnprocessable();
        $other = $this->contact(['phone' => '8801912345678']);
        $this->postJson($this->base.'/contacts/'.$other.'/send', ['client_key' => (string) Str::uuid(), 'kind' => 'template', 'test' => true])->assertUnprocessable();
        Http::assertSentCount(1);
    }

    public function test_campaign_reserves_at_most_fifty_and_rerun_cannot_duplicate_or_exceed_cap(): void
    {
        Http::preventStrayRequests();
        $this->connect(true);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $ids = [];
        for ($i = 0; $i < 51; $i++) {
            $ids[] = $this->contact(['phone' => '88017'.(10000000 + $i)]);
        }
        $this->postJson($this->base.'/campaign', ['contact_ids' => array_slice($ids, 0, 50)])->assertAccepted()->assertJsonPath('data.queued', 50)->assertJsonPath('data.remaining', 0);
        $this->postJson($this->base.'/campaign', ['contact_ids' => [$ids[50]]])->assertAccepted()->assertJsonPath('data.queued', 0);
        $this->postJson($this->base.'/campaign', ['contact_ids' => array_slice($ids, 0, 50)])->assertAccepted()->assertJsonPath('data.queued', 0);
        $this->assertDatabaseCount('wa_messages', 50);
        Http::assertNothingSent();
        DB::table('wa_messages')->update(['occurred_at' => now()->subDays(2)]);
        $this->assertSame(0, app(WhatsAppMessaging::class)->quota(app(WhatsAppMessaging::class)->settings()));
        DB::table('wa_messages')->update(['completed_at' => now()->subDay()->subSecond()]);
        $this->assertSame(50, app(WhatsAppMessaging::class)->quota(app(WhatsAppMessaging::class)->settings()));
    }

    public function test_campaign_ignores_no_consent_opt_out_suppressed_and_test_phone(): void
    {
        $this->connect(true);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $ids = [$this->contact(['opt_in' => false]), $this->contact(['phone' => '8801912345678', 'opt_out' => true]),
            $this->contact(['phone' => '8801612345678', 'suppressed' => true]), $this->contact(['phone' => '8801711945113'])];
        $this->postJson($this->base.'/campaign', ['contact_ids' => $ids])->assertAccepted()->assertJsonPath('data.queued', 0);
        $this->assertDatabaseCount('wa_messages', 0);
    }

    public function test_text_reply_requires_recent_inbound_and_dispatch_rechecks_opt_out(): void
    {
        Http::preventStrayRequests();
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.reply']]])]);
        $this->connect();
        $admin = $this->userWithRole(Role::Admin);
        $this->actingAs($admin);
        $id = $this->contact();
        $this->postJson($this->base.'/contacts/'.$id.'/send', ['kind' => 'text', 'body' => 'Hello', 'client_key' => (string) Str::uuid()])->assertUnprocessable();
        DB::table('wa_contacts')->where('id', $id)->update(['last_inbound_at' => now()->subMinutes(10)]);
        $this->postJson($this->base.'/contacts/'.$id.'/send', ['kind' => 'text', 'body' => 'Hello', 'client_key' => (string) Str::uuid()])->assertOk()->assertJsonPath('data.status', 'accepted');
        Http::assertSentCount(1);
        $wa = app(WhatsAppMessaging::class);
        $queued = $wa->reserve($id, ['kind' => 'text', 'body' => 'Should not send', 'client_key' => (string) Str::uuid()], $admin->id);
        DB::table('wa_contacts')->where('id', $id)->update(['opt_out' => true]);
        $this->assertSame('cancelled', $wa->dispatch($queued->id)->status);
        Http::assertSentCount(1);
    }

    public function test_import_preserves_existing_opt_out_and_normalizes_unique_phone(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $id = $this->contact(['opt_out' => true]);
        $this->postJson($this->base.'/contacts/import', ['contacts' => [
            ['phone' => '01812345678', 'name' => 'Changed', 'opt_in' => true, 'consent_source' => 'Sheet', 'opt_out' => false, 'suppressed' => false],
            ['phone' => '01912345678', 'name' => 'New', 'opt_in' => false, 'opt_out' => false, 'suppressed' => false],
        ]])->assertOk()->assertJsonPath('data.imported', 1)->assertJsonPath('data.skipped', 1);
        $this->assertDatabaseHas('wa_contacts', ['id' => $id, 'opt_out' => true, 'name' => 'Contact']);
        $this->assertDatabaseHas('wa_contacts', ['phone' => '8801912345678', 'opt_in' => false]);
        $this->postJson($this->base.'/contacts', ['phone' => '01212345678'])->assertUnprocessable();
    }

    public function test_webhook_verification_returns_challenge_only_for_saved_token(): void
    {
        $this->connect();
        $this->get('/api/v1/whatsapp/webhook?hub_mode=subscribe&hub_verify_token=long-test-verification-token&hub_challenge=12345')->assertOk()->assertContent('12345');
        $this->get('/api/v1/whatsapp/webhook?hub_mode=subscribe&hub_verify_token=wrong&hub_challenge=12345')->assertForbidden();
    }

    public function test_mark_read_preserves_newer_reply_and_messages_keep_chronological_order(): void
    {
        $this->connect();
        $this->actingAs($this->userWithRole(Role::Admin));
        $this->webhook($this->event([['id' => 'wamid.first', 'from' => '8801812345678', 'type' => 'text', 'text' => ['body' => '<script>text only</script>']], ['id' => 'wamid.second', 'from' => '8801812345678', 'type' => 'text', 'text' => ['body' => 'Second reply']]]))->assertOk();
        $contact = DB::table('wa_contacts')->first();
        $first = DB::table('wa_messages')->where('wa_id', 'wamid.first')->first();
        $this->postJson($this->base.'/contacts/'.$contact->id.'/read', ['through' => $first->id])->assertOk();
        $this->assertDatabaseHas('wa_contacts', ['id' => $contact->id, 'unread' => 1]);
        $this->getJson($this->base.'/contacts/'.$contact->id.'/messages')->assertOk()->assertJsonPath('data.0.body', '<script>text only</script>')->assertJsonPath('data.1.body', 'Second reply');
        $this->getJson($this->base.'/staff')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_uncertain_sends_are_not_retried_and_hold_campaign_capacity(): void
    {
        Http::preventStrayRequests();
        Http::fake(['graph.facebook.com/*' => Http::response(['error' => ['code' => 131000, 'message' => 'test-meta-token']], 500)]);
        $this->connect(true);
        $this->actingAs($this->userWithRole(Role::Admin));
        $id = $this->contact();
        $body = ['kind' => 'template', 'client_key' => (string) Str::uuid()];
        $this->postJson($this->base.'/contacts/'.$id.'/send', $body)->assertOk()->assertJsonPath('data.status', 'uncertain')->assertJsonMissing(['error_details' => 'test-meta-token']);
        $this->postJson($this->base.'/contacts/'.$id.'/send', $body)->assertOk()->assertJsonPath('data.status', 'uncertain');
        Http::assertSentCount(1);
        $this->travel(2)->days();
        $this->assertSame(49, app(WhatsAppMessaging::class)->quota(app(WhatsAppMessaging::class)->settings()));
    }

    public function test_media_url_cannot_forward_meta_token_to_an_untrusted_host(): void
    {
        Http::preventStrayRequests();
        Http::fake(['graph.facebook.com/*' => Http::response(['url' => 'https://evil.example/private', 'file_size' => 100])]);
        $this->connect();
        $this->actingAs($this->userWithRole(Role::Admin));
        $contact = $this->contact();
        $id = DB::table('wa_messages')->insertGetId(['contact_id' => $contact, 'direction' => 'inbound', 'kind' => 'image', 'media_id' => '123456', 'status' => 'received', 'occurred_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        $this->getJson($this->base.'/messages/'.$id.'/media')->assertUnprocessable();
        Http::assertSentCount(1);
    }
}
