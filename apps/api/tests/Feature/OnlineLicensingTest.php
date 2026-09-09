<?php

namespace Tests\Feature;

use App\Enums\LicenseStatus;
use App\Models\Order;
use App\Models\SoftwareLicense;
use App\Services\Licensing\OnlineLicensingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class OnlineLicensingTest extends TestCase
{
    use RefreshDatabase;

    private function license($user, bool $paid = true): SoftwareLicense
    {
        $order = $paid ? Order::factory()->for($user)->paid()->create() : Order::factory()->for($user)->create();
        $item = $order->items()->create(['product_type' => 'software_license', 'product_name' => 'NB Tools', 'variant_name' => 'Single', 'sku' => 'NBET-V6-SINGLE', 'quantity' => 1, 'unit_price_minor' => 100, 'line_total_minor' => 100]);

        return SoftwareLicense::create(['license_code' => 'NB-'.bin2hex(random_bytes(8)), 'user_id' => $user->id, 'order_id' => $order->id, 'order_item_id' => $item->id, 'product_name' => 'NB Tools', 'status' => LicenseStatus::Issued, 'device_limit' => 1, 'issued_at' => now()]);
    }

    public function test_paid_owner_can_pair_and_reconnect_without_duplicate_activation(): void
    {
        config(['online_licensing.enabled' => true]);
        $user = $this->customer();
        $license = $this->license($user);
        $service = app(OnlineLicensingService::class);
        for ($i = 0; $i < 2; $i++) {
            $pair = $service->pair('AABBCCDDEEFF11223344');
            $service->confirm($user, $pair['code'], $license->license_code);
        }
        $this->assertDatabaseCount('nb_token_issues', 1);
        $this->assertDatabaseCount('machine_bindings', 1);
        $issue = DB::table('nb_token_issues')->first();
        $this->assertStringNotContainsString('AABBCC', $issue->payload_encrypted);
        $this->assertSame(50, json_decode(Crypt::decryptString($issue->payload_encrypted), true)['tokens']);
    }

    public function test_other_owner_and_unpaid_license_cannot_pair(): void
    {
        config(['online_licensing.enabled' => true]);
        $owner = $this->customer();
        $other = $this->customer();
        $license = $this->license($owner, false);
        $pair = app(OnlineLicensingService::class)->pair('AABBCCDDEEFF11223344');
        $this->actingAs($other)->postJson('/api/v1/account/connect-device', ['code' => $pair['code'], 'license_code' => $license->license_code])->assertNotFound();
        $this->actingAs($owner)->postJson('/api/v1/account/connect-device', ['code' => $pair['code'], 'license_code' => $license->license_code])->assertForbidden();
        $this->assertDatabaseCount('nb_token_issues', 0);
    }

    public function test_refill_uses_paid_snapshot_and_is_idempotent(): void
    {
        config(['online_licensing.enabled' => true]);
        $user = $this->customer();
        $license = $this->license($user);
        $service = app(OnlineLicensingService::class);
        $pair = $service->pair('AABBCCDDEEFF11223344');
        $service->confirm($user, $pair['code'], $license->license_code);
        $order = Order::factory()->for($user)->paid()->create();
        $order->items()->create(['product_type' => 'credit_refill', 'product_name' => 'Tokens', 'variant_name' => '100', 'sku' => 'T100', 'quantity' => 2, 'unit_price_minor' => 100, 'line_total_minor' => 200, 'fulfillment_meta' => ['credit_amount' => 100]]);
        $service->autoRefill($order);
        $service->autoRefill($order);
        $this->assertDatabaseCount('nb_token_issues', 2);
        $issue = DB::table('nb_token_issues')->where('order_id', $order->id)->first();
        $this->assertSame(200, json_decode(Crypt::decryptString($issue->payload_encrypted), true)['tokens']);
    }

    public function test_expired_pair_and_second_machine_are_rejected(): void
    {
        config(['online_licensing.enabled' => true]);
        $user = $this->customer();
        $license = $this->license($user);
        $service = app(OnlineLicensingService::class);
        $pair = $service->pair('AABBCCDDEEFF11223344');
        DB::table('nb_devices')->update(['expires_at' => now()->subMinute()]);
        $this->actingAs($user)->postJson('/api/v1/account/connect-device', ['code' => $pair['code'], 'license_code' => $license->license_code])->assertUnprocessable();
        $pair = $service->pair('AABBCCDDEEFF11223344');
        $service->confirm($user, $pair['code'], $license->license_code);
        $second = $service->pair('11223344556677889900');
        $this->postJson('/api/v1/account/connect-device', ['code' => $second['code'], 'license_code' => $license->license_code])->assertConflict();
    }

    public function test_worker_and_device_endpoints_reject_unknown_credentials(): void
    {
        config(['online_licensing.enabled' => true, 'online_licensing.worker_token' => str_repeat('a', 64)]);
        $this->getJson('/api/v1/licensing/worker/pending')->assertUnauthorized();
        $this->postJson('/api/v1/licensing/worker/complete', ['id' => 1, 'token' => 'forged'])->assertUnauthorized();
        $this->getJson('/api/v1/licensing/delivery')->assertUnauthorized();
    }

    public function test_worker_payload_cannot_change_entitlement_and_delivery_is_device_scoped(): void
    {
        $credential = str_repeat('a', 64);
        config(['online_licensing.enabled' => true, 'online_licensing.worker_token' => $credential]);
        $user = $this->customer();
        $license = $this->license($user);
        $service = app(OnlineLicensingService::class);
        $pair = $service->pair('AABBCCDDEEFF11223344');
        $service->confirm($user, $pair['code'], $license->license_code);
        $job = $this->withToken($credential)->getJson('/api/v1/licensing/worker/pending')->assertOk()->json('data.0');
        $encode = fn (string $value) => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
        $payload = $job['payload'];
        $payload['tokens'] = 999;
        // Stub signature tests the trusted worker transport; AutoCAD verifies real RSA-PSS.
        $token = 'NB2A.'.$encode(json_encode($payload)).'.'.$encode(str_repeat('x', 256));
        $this->postJson('/api/v1/licensing/worker/complete', ['id' => $job['id'], 'token' => $token])->assertUnprocessable();
        $token = 'NB2A.'.$encode(json_encode($job['payload'])).'.'.$encode(str_repeat('x', 256));
        $this->postJson('/api/v1/licensing/worker/complete', ['id' => $job['id'], 'token' => $token])->assertOk();
        $this->postJson('/api/v1/licensing/worker/complete', ['id' => $job['id'], 'token' => $token])->assertOk();
        $this->withToken($pair['secret'])->getJson('/api/v1/licensing/delivery')->assertOk()->assertJsonCount(1, 'data.issues');
        $other = $service->pair('11223344556677889900');
        $this->withToken($other['secret'])->postJson('/api/v1/licensing/acknowledge', ['id' => $job['id']])->assertUnauthorized();
        $this->withToken($pair['secret'])->postJson('/api/v1/licensing/acknowledge', ['id' => $job['id']])->assertOk();
        $this->getJson('/api/v1/licensing/delivery')->assertOk()->assertJsonCount(0, 'data.issues');
        $license->update(['status' => LicenseStatus::Revoked]);
        $this->getJson('/api/v1/licensing/delivery')->assertForbidden();
    }
}
