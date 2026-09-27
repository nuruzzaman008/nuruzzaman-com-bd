<?php

namespace Tests\Feature;

use App\Enums\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GrowthHubTest extends TestCase
{
    use RefreshDatabase;

    private string $url = '/api/v1/admin/growth-hub';

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    private function owner(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
    }

    public function test_super_admin_still_requires_existing_mfa(): void
    {
        $this->be($this->userWithRole(Role::SuperAdmin));
        $this->getJson($this->url.'/dashboard')->assertForbidden();
    }

    public function test_gemini_and_anthropic_use_their_native_protocols(): void
    {
        $this->owner();
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => 'OK']]]]], 'usageMetadata' => ['promptTokenCount' => 2, 'candidatesTokenCount' => 1]]),
            'api.anthropic.com/*' => Http::response(['content' => [['type' => 'text', 'text' => 'OK']], 'usage' => ['input_tokens' => 2, 'output_tokens' => 1]]),
        ]);
        foreach (['gemini', 'anthropic'] as $name) {
            $id = $this->provider(['provider' => $name]);
            $this->postJson($this->url.'/providers/'.$id.'/test')->assertOk();
        }
        Http::assertSent(fn ($r) => $r->hasHeader('x-goog-api-key', 'secret-test-only') && isset($r['contents'][0]['parts']));
        Http::assertSent(fn ($r) => $r->hasHeader('x-api-key', 'secret-test-only') && $r->hasHeader('anthropic-version', '2023-06-01') && $r['max_tokens'] === 1024);
        $this->assertDatabaseCount('growth_ai_logs', 2);
    }

    public function test_selected_context_includes_only_the_current_owners_records(): void
    {
        $this->owner();
        $this->postJson($this->url.'/goals', ['title' => 'Other owner private goal'])->assertOk();
        $this->owner();
        $this->postJson($this->url.'/goals', ['title' => 'My selected goal'])->assertOk();
        $this->provider();
        Http::fake(['*' => Http::response(['choices' => [['message' => ['content' => 'Suggestion']]]])]);
        $id = $this->postJson($this->url.'/conversations', ['title' => 'Chat'])->json('data.id');
        $this->postJson($this->url.'/conversations/'.$id.'/messages', ['content' => 'Plan', 'context' => ['goals']])->assertOk();
        Http::assertSent(fn ($r) => str_contains(json_encode($r->data()), 'My selected goal') && ! str_contains(json_encode($r->data()), 'Other owner private goal'));
    }

    private function provider(array $extra = []): int
    {
        $this->postJson($this->url.'/providers', $extra + ['provider' => 'openai', 'display_name' => 'Private AI', 'model' => 'test-model', 'api_key' => 'secret-test-only', 'enabled' => true, 'is_default' => false, 'priority' => 10, 'purpose' => 'general'])->assertOk()->assertJsonMissing(['secret' => 'secret-test-only']);

        return (int) DB::table('growth_ai_providers')->max('id');
    }

    public function test_only_super_admin_with_existing_mfa_session_can_enter(): void
    {
        $this->getJson($this->url.'/dashboard')->assertUnauthorized();
        $this->actingAs($this->customer())->getJson($this->url.'/dashboard')->assertForbidden();
        $this->actingAs($this->userWithRole(Role::Admin))->getJson($this->url.'/dashboard')->assertForbidden();
        $this->owner();
        $this->getJson($this->url.'/dashboard')->assertOk()->assertJsonPath('data.gmail', 'disconnected');
    }

    public function test_goal_validation_hierarchy_and_cycle_prevention(): void
    {
        $this->owner();
        $this->postJson($this->url.'/goals', [])->assertUnprocessable();
        $a = $this->postJson($this->url.'/goals', ['title' => 'Vision', 'horizon' => 'vision'])->assertOk()->json('data.id');
        $b = $this->postJson($this->url.'/goals', ['title' => 'Annual', 'parent_id' => $a])->assertOk()->json('data.id');
        $this->putJson($this->url.'/goals/'.$a, ['title' => 'Vision', 'parent_id' => $b])->assertUnprocessable();
        $this->putJson($this->url.'/goals/'.$b, ['title' => 'Updated', 'progress' => 50, 'target_date' => '2027-01-01'])->assertOk();
        $this->deleteJson($this->url.'/goals/'.$a)->assertOk();
        $this->assertDatabaseHas('growth_goals', ['id' => $b, 'parent_id' => null]);
    }

    public function test_private_records_cannot_be_accessed_by_another_super_admin(): void
    {
        $this->owner();
        $id = $this->postJson($this->url.'/ideas', ['title' => 'Private idea'])->json('data.id');
        $this->owner();
        $this->getJson($this->url.'/ideas')->assertJsonCount(0, 'data');
        $this->putJson($this->url.'/ideas/'.$id, ['title' => 'stolen'])->assertNotFound();
        $this->deleteJson($this->url.'/ideas/'.$id)->assertNotFound();
    }

    public function test_top_three_slots_are_unique_and_reviews_are_historical(): void
    {
        $this->owner();
        $body = ['title' => 'Focus', 'focus_date' => '2026-09-27', 'focus_rank' => 1];
        $this->postJson($this->url.'/tasks', $body)->assertOk();
        $this->postJson($this->url.'/tasks', $body)->assertUnprocessable();
        $this->postJson($this->url.'/tasks', ['title' => 'bad', 'focus_rank' => 4])->assertUnprocessable();
        $this->putJson($this->url.'/reviews', ['review_date' => '2026-09-27', 'learned' => 'Lesson'])->assertOk();
        $this->putJson($this->url.'/reviews', ['review_date' => '2026-09-28', 'learned' => 'Next lesson'])->assertOk();
        $this->getJson($this->url.'/reviews')->assertJsonCount(2, 'data');
    }

    public function test_keys_are_encrypted_and_never_returned_and_blank_edit_preserves_key(): void
    {
        $this->owner();
        $id = $this->provider();
        $stored = DB::table('growth_ai_providers')->find($id)->secret;
        $this->assertNotSame('secret-test-only', $stored);
        $this->assertSame('secret-test-only', Crypt::decryptString($stored));
        $response = $this->getJson($this->url.'/providers')->assertOk();
        $this->assertStringNotContainsString($stored, $response->getContent());
        $this->assertStringNotContainsString('secret-test-only', $response->getContent());
        $this->putJson($this->url.'/providers/'.$id, ['provider' => 'openai', 'display_name' => 'Edited', 'model' => 'test-model', 'api_key' => '', 'enabled' => true, 'is_default' => true, 'priority' => 1, 'purpose' => 'general'])->assertOk();
        $this->assertSame($stored, DB::table('growth_ai_providers')->find($id)->secret);
    }

    public function test_connection_and_fallback_are_logged_without_provider_error_secrets(): void
    {
        $this->owner();
        $this->provider(['priority' => 1]);
        $this->provider(['provider' => 'openrouter', 'priority' => 2]);
        Http::fake(['api.openai.com/*' => Http::response(['error' => 'secret-test-only'], 500), 'openrouter.ai/*' => Http::response(['choices' => [['message' => ['content' => 'A suggestion']]], 'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 5]])]);
        $chat = $this->postJson($this->url.'/conversations', ['title' => 'Plan'])->json('data.id');
        $this->postJson($this->url.'/conversations/'.$chat.'/messages', ['content' => 'Help plan', 'context' => []])->assertOk()->assertJsonPath('data.1.content', 'A suggestion');
        $this->assertDatabaseCount('growth_ai_logs', 2);
        $this->assertStringNotContainsString('secret-test-only', $this->getJson($this->url.'/ai-history')->getContent());
    }

    public function test_context_is_explicit_and_owner_scoped(): void
    {
        $this->owner();
        $this->postJson($this->url.'/goals', ['title' => 'Hidden private goal']);
        $this->provider();
        Http::fake(['*' => Http::response(['choices' => [['message' => ['content' => 'Suggestion']]]])]);
        $id = $this->postJson($this->url.'/conversations', ['title' => 'Chat'])->json('data.id');
        $this->postJson($this->url.'/conversations/'.$id.'/messages', ['content' => 'hello', 'context' => []])->assertOk();
        Http::assertSent(fn ($r) => ! str_contains(json_encode($r->data()), 'Hidden private goal'));
    }

    public function test_disconnected_ai_does_not_lose_user_data_or_fabricate_messages(): void
    {
        $this->owner();
        $id = $this->postJson($this->url.'/conversations', ['title' => 'Chat'])->json('data.id');
        $this->postJson($this->url.'/conversations/'.$id.'/messages', ['content' => 'hello', 'context' => []])->assertUnprocessable();
        $this->assertDatabaseCount('growth_messages', 0);
        Http::assertNothingSent();
    }

    public function test_custom_private_url_and_missing_budget_rates_are_refused(): void
    {
        $this->owner();
        $body = ['provider' => 'custom', 'display_name' => 'Custom', 'model' => 'test', 'enabled' => true, 'is_default' => false, 'priority' => 1, 'purpose' => 'general', 'base_url' => 'https://127.0.0.1'];
        $this->postJson($this->url.'/providers', $body)->assertUnprocessable();
        $body['provider'] = 'openai';
        $body['monthly_budget'] = 10;
        $this->postJson($this->url.'/providers', $body)->assertUnprocessable();
    }

    public function test_budget_blocks_network_requests_and_preferences_validate(): void
    {
        $this->owner();
        $id = $this->provider(['monthly_budget' => 0, 'input_rate' => 1, 'output_rate' => 1]);
        $this->postJson($this->url.'/providers/'.$id.'/test')->assertUnprocessable();
        Http::assertNothingSent();
        $this->putJson($this->url.'/preferences', ['timezone' => 'Asia/Dhaka', 'cards' => ['focus', 'goals']])->assertOk();
        $this->putJson($this->url.'/preferences', ['timezone' => 'fake', 'cards' => []])->assertUnprocessable();
    }

    public function test_conversation_rename_archive_delete_and_foreign_id_rejection(): void
    {
        $this->owner();
        $id = $this->postJson($this->url.'/conversations', ['title' => 'Original'])->json('data.id');
        $this->patchJson($this->url.'/conversations/'.$id, ['title' => 'Renamed', 'archived' => true])->assertOk();
        $this->getJson($this->url.'/conversations?archived=1')->assertJsonPath('data.0.title', 'Renamed');
        $this->postJson($this->url.'/conversations/'.$id.'/messages', ['content' => 'No', 'context' => []])->assertStatus(409);
        $this->owner();
        $this->getJson($this->url.'/conversations/'.$id.'/messages')->assertNotFound();
        $this->deleteJson($this->url.'/conversations/'.$id)->assertNotFound();
    }

    public function test_provider_health_check_uses_real_adapter_contract(): void
    {
        $this->owner();
        $id = $this->provider();
        Http::fake(['api.openai.com/*' => Http::response(['choices' => [['message' => ['content' => 'OK']]], 'usage' => ['prompt_tokens' => 5, 'completion_tokens' => 1]])]);
        $this->postJson($this->url.'/providers/'.$id.'/test')->assertOk()->assertJsonPath('data.status', 'connected');
        Http::assertSent(fn ($r) => $r->hasHeader('Authorization', 'Bearer secret-test-only') && $r['model'] === 'test-model');
    }
}
