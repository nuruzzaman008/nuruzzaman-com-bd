<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Services\WhatsApp\WhatsAppCalling;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class WhatsAppCallingTest extends TestCase
{
    use RefreshDatabase;

    private string $base = '/api/v1/admin/whatsapp';

    private function setupConnection(): int
    {
        DB::table('wa_settings')->where('id', 1)->update(['enabled' => true, 'access_token' => Crypt::encryptString('fixture'), 'app_secret' => Crypt::encryptString('secret')]);

        return DB::table('wa_contacts')->insertGetId(['phone' => '8801711945113', 'name' => 'Test', 'last_inbound_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
    }

    private function payload(array $call, string $waba = '1569882861085596'): array
    {
        return ['object' => 'whatsapp_business_account', 'entry' => [['id' => $waba, 'changes' => [['field' => 'calls', 'value' => ['metadata' => ['phone_number_id' => '1312758371929461'], 'calls' => [$call]]]]]]];
    }

    private function offer(): array
    {
        return ['id' => 'wacid.inbound', 'from' => '8801711945113', 'direction' => 'USER_INITIATED', 'event' => 'connect', 'session' => ['sdp_type' => 'offer', 'sdp' => "v=0\r\n"], 'timestamp' => (string) now()->timestamp];
    }

    public function test_calls_require_staff_authentication_and_signed_webhooks(): void
    {
        $this->setupConnection();
        $this->getJson($this->base.'/calls?session_key='.Str::uuid())->assertUnauthorized();
        $this->actingAs($this->customer())->getJson($this->base.'/calls?session_key='.Str::uuid())->assertForbidden();
        $json = json_encode($this->payload($this->offer()));
        $this->call('POST', '/api/v1/whatsapp/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_HUB_SIGNATURE_256' => 'sha256=bad'], $json)->assertForbidden();
        $this->assertDatabaseCount('wa_calls', 0);
        $this->call('POST', '/api/v1/whatsapp/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_HUB_SIGNATURE_256' => 'sha256='.hash_hmac('sha256', $json, 'secret')], $json)->assertOk();
        $this->assertDatabaseHas('wa_calls', ['wa_id' => 'wacid.inbound', 'direction' => 'inbound', 'status' => 'ringing']);
    }

    public function test_duplicate_or_late_call_events_cannot_resurrect_ended_calls(): void
    {
        $this->setupConnection();
        $wa = app(WhatsAppCalling::class);
        $wa->ingest($this->payload($this->offer(), 'wrong'));
        $this->assertDatabaseCount('wa_calls', 0);
        $wa->ingest($this->payload($this->offer()));
        $wa->ingest($this->payload($this->offer()));
        $this->assertDatabaseCount('wa_calls', 1);
        $wa->ingest($this->payload(['id' => 'wacid.inbound', 'event' => 'terminate', 'status' => 'COMPLETED', 'duration' => 12]));
        $wa->ingest($this->payload($this->offer()));
        $this->assertDatabaseHas('wa_calls', ['wa_id' => 'wacid.inbound', 'status' => 'completed', 'remote_sdp' => null, 'duration' => 12]);
    }

    public function test_one_operator_and_tab_claims_audio_and_other_staff_cannot_read_sdp_or_hang_up(): void
    {
        $this->setupConnection();
        app(WhatsAppCalling::class)->ingest($this->payload($this->offer()));
        $id = DB::table('wa_calls')->value('id');
        $key = (string) Str::uuid();
        $other = (string) Str::uuid();
        $admin = $this->userWithRole(Role::Admin);
        $this->actingAs($admin);
        $this->getJson($this->base.'/calls?session_key='.$key)->assertJsonPath('data.0.remote_sdp', null);
        $this->postJson($this->base.'/calls/'.$id.'/action', ['action' => 'claim', 'session_key' => $key])->assertOk()->assertJsonPath('data.sdp', "v=0\r\n");
        $this->getJson($this->base.'/calls?session_key='.$key)->assertJsonPath('data.0.mine', true)->assertJsonPath('data.0.remote_sdp', "v=0\r\n");
        $this->getJson($this->base.'/calls?session_key='.$other)->assertJsonPath('data.0.remote_sdp', null);
        $this->postJson($this->base.'/calls/'.$id.'/action', ['action' => 'pre_accept', 'session_key' => $other, 'sdp' => 'v=0'])->assertConflict();
        $this->actingAs($this->userWithRole(Role::Admin));
        $this->postJson($this->base.'/calls/'.$id.'/action', ['action' => 'terminate', 'session_key' => $other])->assertConflict();
        $this->postJson($this->base.'/calls/'.$id.'/action', ['action' => 'claim', 'session_key' => $other])->assertConflict();
        Http::fake(['graph.facebook.com/*' => Http::response(['success' => true])]);
        $this->actingAs($admin)->postJson($this->base.'/calls/'.$id.'/action', ['action' => 'reject', 'session_key' => $key])->assertOk();
        $this->assertDatabaseHas('wa_calls', ['id' => $id, 'status' => 'reject', 'remote_sdp' => null]);
    }

    public function test_outgoing_requires_current_meta_permission_and_idempotently_sends_one_offer(): void
    {
        $contact = $this->setupConnection();
        $this->actingAs($this->userWithRole(Role::Admin));
        Http::preventStrayRequests();
        $allow = false;
        Http::fake(function ($request) use (&$allow) {
            if (str_contains($request->url(), 'call_permissions')) {
                return Http::response(['permission' => ['status' => $allow ? 'permanent' : 'no_permission'], 'actions' => [['action_name' => 'start_call', 'can_perform_action' => $allow]]]);
            }

            return Http::response(['calls' => [['id' => 'wacid.outbound']]]);
        });
        $data = ['client_key' => (string) Str::uuid(), 'session_key' => (string) Str::uuid(), 'sdp' => "v=0\r\n"];
        $this->postJson($this->base.'/contacts/'.$contact.'/call', $data)->assertUnprocessable();
        $this->assertDatabaseCount('wa_calls', 0);
        $allow = true;
        $this->postJson($this->base.'/contacts/'.$contact.'/call', $data)->assertOk();
        $this->postJson($this->base.'/contacts/'.$contact.'/call', $data)->assertOk();
        $this->assertCount(1, Http::recorded(fn ($r) => $r->method() === 'POST' && str_ends_with($r->url(), '/calls')));
        Http::assertSent(fn ($r) => $r->method() === 'POST' && $r['action'] === 'connect' && $r['to'] === '8801711945113' && $r['session']['sdp_type'] === 'offer');
        DB::table('wa_contacts')->where('id', $contact)->update(['opt_out' => true]);
        $this->postJson($this->base.'/contacts/'.$contact.'/call', array_replace($data, ['client_key' => (string) Str::uuid()]))->assertUnprocessable();
    }

    public function test_call_permission_message_is_free_form_interactive_inside_reply_window_only(): void
    {
        $contact = $this->setupConnection();
        $this->actingAs($this->userWithRole(Role::Admin));
        Http::preventStrayRequests();
        Http::fake(function ($r) {
            return str_contains($r->url(), 'call_permissions') ? Http::response(['actions' => [['action_name' => 'send_call_permission_request', 'can_perform_action' => true]]]) : Http::response(['messages' => [['id' => 'wamid.permission']]]);
        });
        $this->postJson($this->base.'/contacts/'.$contact.'/call-permission', ['client_key' => (string) Str::uuid()])->assertOk()->assertJsonPath('data.status', 'accepted');
        Http::assertSent(fn ($r) => $r->method() === 'POST' && $r['type'] === 'interactive' && $r['interactive']['type'] === 'call_permission_request');
        DB::table('wa_contacts')->where('id', $contact)->update(['last_inbound_at' => now()->subHours(25)]);
        $this->postJson($this->base.'/contacts/'.$contact.'/call-permission', ['client_key' => (string) Str::uuid()])->assertUnprocessable();
        $this->assertCount(1, Http::recorded(fn ($r) => $r->method() === 'POST'));
    }

    public function test_preaccept_and_accept_send_real_answer_and_clear_audio_on_end(): void
    {
        $this->setupConnection();
        app(WhatsAppCalling::class)->ingest($this->payload($this->offer()));
        $id = DB::table('wa_calls')->value('id');
        $key = (string) Str::uuid();
        $this->actingAs($this->userWithRole(Role::Admin));
        Http::fake(['graph.facebook.com/*' => Http::response(['success' => true])]);
        $this->postJson($this->base.'/calls/'.$id.'/action', ['action' => 'claim', 'session_key' => $key])->assertOk();
        $this->postJson($this->base.'/calls/'.$id.'/action', ['action' => 'accept', 'session_key' => $key])->assertUnprocessable();
        foreach (['pre_accept', 'accept'] as $action) {
            $this->postJson($this->base.'/calls/'.$id.'/action', ['action' => $action, 'session_key' => $key, 'sdp' => "v=0\r\n"])->assertOk();
        }
        Http::assertSent(fn ($r) => $r['action'] === 'accept' && $r['session']['sdp_type'] === 'answer');
        $this->postJson($this->base.'/calls/'.$id.'/action', ['action' => 'terminate', 'session_key' => $key])->assertOk();
        $this->postJson($this->base.'/calls/'.$id.'/action', ['action' => 'accept', 'session_key' => $key, 'sdp' => "v=0\r\n"])->assertConflict();
        $this->assertDatabaseHas('wa_calls', ['id' => $id, 'remote_sdp' => null, 'status' => 'terminate']);
    }
}
