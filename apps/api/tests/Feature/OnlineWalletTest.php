<?php

namespace Tests\Feature;

use App\Enums\LicenseStatus;
use App\Models\Order;
use App\Models\SoftwareLicense;
use App\Services\Licensing\OnlineLicensingService;
use App\Services\Licensing\OnlineWalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class OnlineWalletTest extends TestCase
{
    use RefreshDatabase;

    public function test_configured_opening_offer_is_a_single_identified_ledger_entry(): void
    {
        config(['online_licensing.enabled' => true, 'online_wallet.enabled' => true,
            'online_wallet.cutover_at' => now()->subHour()->toIso8601String(), 'online_wallet.opening_offer' => 75]);
        $user = $this->customer();
        $license = $this->license($user);
        $service = app(OnlineLicensingService::class);
        foreach (range(1, 2) as $attempt) {
            $pair = $service->pair('AABBCCDDEEFF11223344');
            $service->confirm($user, $pair['code'], $license->license_code);
        }
        $entry = DB::table('nb_wallet_entries')->where('software_license_id', $license->id)->sole();
        $this->assertTrue(\Illuminate\Support\Str::isUuid($entry->transaction_id));
        $this->assertSame('opening_offer', $entry->source);
        $this->assertSame($user->id, $entry->user_id);
        $this->assertSame(75, $entry->delta);
        $this->assertSame(75, app(OnlineWalletService::class)->balance($license));
        $this->assertSame(0, (int) DB::table('nb_online_wallets')->value('reserved_balance'));
    }

    private function license($user, bool $paid = true): SoftwareLicense
    {
        $order = $paid ? Order::factory()->for($user)->paid()->create() : Order::factory()->for($user)->create();
        $item = $order->items()->create(['product_type' => 'software_license', 'product_name' => 'NB Tools', 'variant_name' => 'Single', 'sku' => 'NBET-V6-SINGLE', 'quantity' => 1, 'unit_price_minor' => 100, 'line_total_minor' => 100]);

        return SoftwareLicense::create(['license_code' => 'NB-'.bin2hex(random_bytes(8)), 'user_id' => $user->id, 'order_id' => $order->id, 'order_item_id' => $item->id, 'product_name' => 'NB Tools', 'status' => LicenseStatus::Issued, 'device_limit' => 1, 'issued_at' => now()]);
    }

    private function connected(int $balance = 10): array
    {
        config(['online_licensing.enabled' => true, 'online_wallet.enabled' => true]);
        $user = $this->customer();
        $license = $this->license($user);
        DB::table('nb_online_wallets')->insert(['software_license_id' => $license->id, 'balance' => $balance, 'created_at' => now()->subDay(), 'updated_at' => now()]);
        $service = app(OnlineLicensingService::class);
        $pair = $service->pair('AABBCCDDEEFF11223344');
        $service->confirm($user, $pair['code'], $license->license_code);
        $this->withToken($pair['secret']);

        return [$license, $pair, $user];
    }

    public function test_usage_retries_reconnect_and_offline_replay_do_not_reset_balance(): void
    {
        [$license, $pair, $user] = $this->connected();
        $input = ['command' => 'NBSLABDRAWING', 'units' => 2, 'operation_id' => 'f8fc83ba-a112-4faa-b742-6719dac52a34'];
        $this->postJson('/api/v1/licensing/wallet/operation', $input)->assertOk()->assertJsonPath('data.balance', 6);
        $this->postJson('/api/v1/licensing/wallet/operation', $input)->assertOk()->assertJsonPath('data.balance', 6)->assertJsonPath('data.replayed', true);
        $this->postJson('/api/v1/licensing/wallet/operation', [...$input, 'units' => 3])->assertConflict();
        $this->getJson('/api/v1/licensing/delivery')->assertConflict();
        $service = app(OnlineLicensingService::class);
        $new = $service->pair('AABBCCDDEEFF11223344');
        $service->confirm($user, $new['code'], $license->license_code);
        $this->getJson('/api/v1/licensing/wallet')->assertUnauthorized();
        $this->withToken($new['secret'])->getJson('/api/v1/licensing/wallet')->assertOk()->assertJsonPath('data.balance', 6);
        $this->assertDatabaseCount('nb_token_issues', 0);
        $this->assertDatabaseCount('nb_wallet_entries', 1);
    }

    public function test_daily_fee_is_server_owned_and_unaffordable_or_unknown_work_is_rejected(): void
    {
        $this->connected(2);
        $this->postJson('/api/v1/licensing/wallet/operation', ['command' => 'RM', 'units' => 1])->assertOk()->assertJsonPath('data.balance', 2);
        foreach (['f8fc83ba-a112-4faa-b742-6719dac52a34', 'f8fc83ba-a112-4faa-b742-6719dac52a35'] as $id) {
            $this->postJson('/api/v1/licensing/wallet/operation', ['command' => 'RM', 'units' => 1, 'operation_id' => $id])->assertOk()->assertJsonPath('data.balance', 1);
        }
        $this->postJson('/api/v1/licensing/wallet/operation', ['command' => 'NBLOADUI', 'units' => 1, 'operation_id' => 'f8fc83ba-a112-4faa-b742-6719dac52a36'])->assertConflict();
        $this->postJson('/api/v1/licensing/wallet/operation', ['command' => 'FORGED', 'units' => 1])->assertUnprocessable();
        $this->postJson('/api/v1/licensing/wallet/operation', ['command' => 'RM', 'units' => -1])->assertUnprocessable();
        $this->travel(1)->days();
        $this->postJson('/api/v1/licensing/wallet/operation', ['command' => 'RM', 'units' => 1, 'operation_id' => 'f8fc83ba-a112-4faa-b742-6719dac52a37'])->assertOk()->assertJsonPath('data.balance', 0);
    }

    public function test_payment_credit_is_once_only_and_revocation_blocks_wallet(): void
    {
        [$license, , $user] = $this->connected();
        $order = Order::factory()->for($user)->paid()->create();
        $order->items()->create(['product_type' => 'credit_refill', 'product_name' => 'Tokens', 'variant_name' => '100', 'sku' => 'T100', 'quantity' => 2, 'unit_price_minor' => 100, 'line_total_minor' => 200, 'fulfillment_meta' => ['credit_amount' => 100]]);
        $service = app(OnlineLicensingService::class);
        $service->autoRefill($order);
        $service->autoRefill($order);
        $this->getJson('/api/v1/licensing/wallet')->assertOk()->assertJsonPath('data.balance', 210);
        $this->assertDatabaseCount('nb_wallet_entries', 1);
        $this->assertDatabaseCount('nb_token_issues', 0);
        $license->update(['status' => LicenseStatus::Revoked]);
        $this->getJson('/api/v1/licensing/wallet')->assertForbidden();
    }

    public function test_unpaid_and_other_users_orders_cannot_credit_wallet(): void
    {
        [$license, , $user] = $this->connected();
        $pending = Order::factory()->for($user)->create();
        $this->actingAs($user)->postJson('/api/v1/account/refill-device', ['order_number' => $pending->number, 'license_code' => $license->license_code])->assertForbidden();
        $other = Order::factory()->for($this->customer())->paid()->create();
        $this->postJson('/api/v1/account/refill-device', ['order_number' => $other->number, 'license_code' => $license->license_code])->assertNotFound();
        $this->assertSame(10, app(OnlineWalletService::class)->balance($license));
    }

    public function test_disabling_online_service_does_not_restore_offline_delivery(): void
    {
        $this->connected();
        config(['online_wallet.enabled' => false]);
        $this->getJson('/api/v1/licensing/wallet')->assertStatus(503);
        $this->getJson('/api/v1/licensing/delivery')->assertConflict();
    }

    public function test_cutover_grants_once_and_rebinding_after_reinstall_preserves_balance(): void
    {
        config(['online_licensing.enabled' => true, 'online_wallet.enabled' => true, 'online_wallet.cutover_at' => now()->subHour()->toIso8601String()]);
        $user = $this->customer();
        $license = $this->license($user);
        $service = app(OnlineLicensingService::class);
        $pair = $service->pair('AABBCCDDEEFF11223344');
        $service->confirm($user, $pair['code'], $license->license_code);
        $this->withToken($pair['secret'])->postJson('/api/v1/licensing/wallet/operation', ['command' => 'NBFOOTING', 'units' => 2, 'operation_id' => 'f8fc83ba-a112-4faa-b742-6719dac52a38'])->assertOk()->assertJsonPath('data.balance', 48);
        // Admin releases the old binding after the OS changes its machine fingerprint.
        $license->machineBindings()->update(['released_at' => now()]);
        $new = $service->pair('99887766554433221100');
        $service->confirm($user, $new['code'], $license->license_code);
        $this->withToken($new['secret'])->getJson('/api/v1/licensing/wallet')->assertOk()->assertJsonPath('data.balance', 48);
        $this->assertDatabaseCount('nb_online_wallets', 1);
        $this->assertDatabaseCount('nb_wallet_entries', 2);
        $this->assertDatabaseCount('nb_token_issues', 0);
        $this->withToken($pair['secret'])->getJson('/api/v1/licensing/wallet')->assertForbidden();
        $order = Order::factory()->for($user)->paid()->create();
        $order->items()->create(['product_type' => 'credit_refill', 'product_name' => 'Tokens', 'variant_name' => '100', 'sku' => 'T100', 'quantity' => 1, 'unit_price_minor' => 100, 'line_total_minor' => 100, 'fulfillment_meta' => ['credit_amount' => 100]]);
        $service->autoRefill($order);
        $this->withToken($new['secret'])->getJson('/api/v1/licensing/wallet')->assertOk()->assertJsonPath('data.balance', 148);

    }

    public function test_migration_does_not_recredit_older_purchases_or_allow_wallet_reset(): void
    {
        [$license, , $user] = $this->connected();
        $old = Order::factory()->for($user)->paid()->create(['created_at' => now()->subDays(2)]);
        $this->actingAs($user)->postJson('/api/v1/account/refill-device', ['order_number' => $old->number, 'license_code' => $license->license_code])->assertConflict();
        $this->assertSame(10, app(OnlineWalletService::class)->balance($license));
        $this->artisan('nb:enable-online-wallet', ['license' => $license->license_code, 'opening_balance' => '999', '--reason' => 'Missing acknowledgement'])->assertFailed();
        $this->assertSame(10, app(OnlineWalletService::class)->balance($license));
    }

    public function test_suspended_accounts_and_refunded_credits_are_blocked(): void
    {
        [$license, , $user] = $this->connected();
        $order = Order::factory()->for($user)->paid()->create();
        $order->items()->create(['product_type' => 'credit_refill', 'product_name' => 'Tokens', 'variant_name' => '100', 'sku' => 'T100', 'quantity' => 1, 'unit_price_minor' => 100, 'line_total_minor' => 100, 'fulfillment_meta' => ['credit_amount' => 100]]);
        app(OnlineLicensingService::class)->autoRefill($order);
        $order->update(['status' => 'partially_refunded']);
        $this->getJson('/api/v1/licensing/wallet')->assertForbidden();
        $order->update(['status' => 'paid']);
        $user->update(['status' => 'suspended']);
        $this->getJson('/api/v1/licensing/wallet')->assertForbidden();
    }
}
