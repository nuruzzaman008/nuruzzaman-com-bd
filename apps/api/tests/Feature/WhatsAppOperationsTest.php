<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Order;
use App\Notifications\NotificationPresenter;
use App\Services\WhatsApp\WhatsAppMessaging;
use App\Services\WhatsApp\WhatsAppOrderConfirmation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class WhatsAppOperationsTest extends TestCase
{
    use RefreshDatabase;

    private function connected(): void
    {
        DB::table('wa_settings')->where('id', 1)->update(['enabled' => true, 'access_token' => Crypt::encryptString('test-token'), 'campaign_enabled' => false]);
        Http::preventStrayRequests();
    }

    private function fakeMeta(string $status = 'APPROVED'): void
    {
        Http::fake(fn ($r) => $r->method() === 'GET' ? Http::response(['data' => [['name' => 'nb_order_confirmation_v1', 'language' => 'bn', 'category' => 'UTILITY', 'status' => $status]]]) : Http::response(['messages' => [['id' => 'wamid.'.Str::uuid()]]]));
    }

    public function test_admin_can_import_contacts_and_start_a_single_template_without_enabling_bulk_campaign(): void
    {
        $this->connected();
        $this->fakeMeta();
        $this->actingAs($this->userWithRole(Role::Admin));
        $this->postJson('/api/v1/admin/whatsapp/contacts/import', ['contacts' => [['phone' => '01712345678', 'name' => 'Customer', 'opt_in' => true, 'consent_source' => 'Written consent', 'opt_out' => false, 'suppressed' => false]]])->assertOk()->assertJsonPath('data.imported', 1);
        $contact = DB::table('wa_contacts')->value('id');
        $this->postJson('/api/v1/admin/whatsapp/contacts/'.$contact.'/send', ['kind' => 'template', 'template' => 'nbconsultant_intro_v1', 'manual' => true, 'client_key' => (string) Str::uuid()])->assertOk()->assertJsonPath('data.mode', 'manual');
        $this->assertSame(49, app(WhatsAppMessaging::class)->quota(app(WhatsAppMessaging::class)->settings()));
        $this->postJson('/api/v1/admin/whatsapp/contacts/'.$contact.'/send', ['kind' => 'template', 'client_key' => (string) Str::uuid()])->assertUnprocessable();
        $this->assertDatabaseHas('wa_settings', ['id' => 1, 'campaign_enabled' => false]);
    }

    public function test_incoming_whatsapp_notifies_only_admins_once_and_links_the_contact(): void
    {
        $admin = $this->userWithRole(Role::Admin);
        $super = $this->userWithRole(Role::SuperAdmin);
        $support = $this->userWithRole(Role::Support);
        $payload = ['object' => 'whatsapp_business_account', 'entry' => [['id' => '1569882861085596', 'changes' => [['field' => 'messages', 'value' => ['metadata' => ['phone_number_id' => '1312758371929461'], 'messages' => [['id' => 'wamid.alert', 'from' => '8801712345678', 'type' => 'text', 'text' => ['body' => 'Hello'], 'timestamp' => now()->timestamp]]]]]]]];
        $wa = app(WhatsAppMessaging::class);
        $wa->ingest($payload);
        $wa->ingest($payload);
        $this->assertSame(1, $admin->notifications()->where('type', 'whatsapp.message')->count());
        $this->assertSame(1, $super->notifications()->where('type', 'whatsapp.message')->count());
        $this->assertSame(0, $support->notifications()->where('type', 'whatsapp.message')->count());
        $n = $admin->notifications()->where('type', 'whatsapp.message')->first();
        $this->assertSame('/dashboard/whatsapp?contact='.$n->data['wa_contact_id'], NotificationPresenter::present($n->type, $n->data, 'en')['url']);
        $this->assertDatabaseCount('notification_emails', 0);
    }

    public function test_paid_order_confirmation_waits_for_utility_approval_and_sends_once_without_marketing_opt_in(): void
    {
        Queue::fake();
        $this->connected();
        $this->fakeMeta('PENDING');
        $order = Order::factory()->paid()->create(['billing_phone' => '01712345678', 'accepted_terms' => ['whatsapp_confirmation']]);
        $service = app(WhatsAppOrderConfirmation::class);
        $service->queue($order);
        $service->queue($order);
        $this->assertDatabaseCount('wa_order_confirmations', 1);
        $service->process();
        $this->assertDatabaseCount('wa_messages', 0);
        Cache::flush();
        Http::swap(new Factory);
        Http::preventStrayRequests();
        $this->fakeMeta();
        $service->process();
        $service->process();
        $this->assertDatabaseCount('wa_messages', 1);
        $this->assertDatabaseHas('wa_messages', ['mode' => 'confirmation', 'template' => 'nb_order_confirmation_v1', 'status' => 'accepted']);
        $this->assertDatabaseHas('wa_contacts', ['phone' => '8801712345678', 'opt_in' => false]);
        Http::assertSent(fn ($r) => $r->method() === 'POST' && $r['template']['name'] === 'nb_order_confirmation_v1' && $r['template']['language']['code'] === 'bn' && count($r['template']['components'][0]['parameters']) === 4);
        $this->assertCount(1, Http::recorded(fn ($r) => $r->method() === 'POST'));
    }

    public function test_unpaid_nonconsenting_and_opted_out_orders_cannot_send_confirmation(): void
    {
        $this->connected();
        $this->fakeMeta();
        $service = app(WhatsAppOrderConfirmation::class);
        $unpaid = Order::factory()->create(['billing_phone' => '01712345678', 'accepted_terms' => ['whatsapp_confirmation']]);
        $service->queue($unpaid);
        $this->assertDatabaseCount('wa_order_confirmations', 0);
        $noConsent = Order::factory()->paid()->create(['billing_phone' => '01712345678']);
        $service->queue($noConsent);
        DB::table('wa_contacts')->insert(['phone' => '8801812345678', 'opt_out' => true, 'opt_in' => true, 'created_at' => now(), 'updated_at' => now()]);
        $optedOut = Order::factory()->paid()->create(['billing_phone' => '01812345678', 'accepted_terms' => ['whatsapp_confirmation']]);
        $service->queue($optedOut);
        $service->process();
        $this->assertDatabaseCount('wa_messages', 0);
        Http::assertNotSent(fn ($r) => $r->method() === 'POST');
    }

    public function test_paid_event_reserves_a_confirmation_but_failed_payment_does_not(): void
    {
        Queue::fake();
        $order = Order::factory()->paid()->create(['billing_phone' => '01712345678', 'accepted_terms' => ['whatsapp_confirmation']]);
        $order->statusEvents()->create(['from_status' => 'pending_payment', 'to_status' => 'paid']);
        $this->assertDatabaseHas('wa_order_confirmations', ['order_id' => $order->id, 'status' => 'pending']);
        $failed = Order::factory()->create();
        $failed->statusEvents()->create(['from_status' => 'pending_payment', 'to_status' => 'failed']);
        $this->assertDatabaseCount('wa_order_confirmations',1);
    }
}
