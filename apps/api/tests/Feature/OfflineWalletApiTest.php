<?php

namespace Tests\Feature;

use App\Enums\LicenseStatus;
use App\Enums\Role;
use App\Models\Order;
use App\Models\SoftwareLicense;
use App\Services\Licensing\OnlineLicensingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class OfflineWalletApiTest extends TestCase
{
    use RefreshDatabase;

    private static string $keyPath;

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        if (! $key || ! openssl_pkey_export($key, $pem)) {
            throw new \RuntimeException('Set OPENSSL_CONF for the isolated RSA test fixture.');
        }
        self::$keyPath = tempnam(sys_get_temp_dir(), 'nb-wallet-api-test-');
        file_put_contents(self::$keyPath, $pem);
    }

    public static function tearDownAfterClass(): void
    {
        if (isset(self::$keyPath)) {
            unlink(self::$keyPath);
        }
        parent::tearDownAfterClass();
    }

    private function license($user, bool $paid = true): SoftwareLicense
    {
        $order = $paid ? Order::factory()->for($user)->paid()->create() : Order::factory()->for($user)->create();
        $item = $order->items()->create(['product_type' => 'software_license', 'product_name' => 'NB Tools', 'variant_name' => 'Single', 'sku' => 'NBET-V6-SINGLE', 'quantity' => 1, 'unit_price_minor' => 100, 'line_total_minor' => 100]);

        return SoftwareLicense::create(['license_code' => 'NB-'.bin2hex(random_bytes(8)), 'user_id' => $user->id, 'order_id' => $order->id, 'order_item_id' => $item->id, 'product_name' => 'NB Tools', 'status' => LicenseStatus::Issued, 'device_limit' => 1, 'issued_at' => now()]);
    }

    private function connected(): array
    {
        config(['online_licensing.enabled' => true, 'online_wallet.enabled' => true, 'offline_wallet.enabled' => true, 'offline_wallet.signing_key_path' => self::$keyPath, 'offline_wallet.signing_key_id' => 'isolated-test']);
        $user = $this->customer();
        $license = $this->license($user);
        DB::table('nb_online_wallets')->insert(['software_license_id' => $license->id, 'balance' => 100, 'created_at' => now(), 'updated_at' => now()]);
        $pair = app(OnlineLicensingService::class)->pair('AABBCCDDEEFF11223344');
        app(OnlineLicensingService::class)->confirm($user, $pair['code'], $license->license_code);
        $this->withToken($pair['secret']);

        return [$license, $pair, $user];
    }

    private function connect(int $allowance = 20): array
    {
        return $this->postJson('/api/wallet/connect', ['request_id' => (string) Str::uuid(), 'expected_version' => 0, 'requested_allowance' => $allowance])->assertOk()->json();
    }

    public function test_online_command_uses_same_wallet_preserves_reserve_and_replays_once(): void
    {
        [$license] = $this->connected();
        $this->connect(20);
        $input = ['command' => 'NBFOOTING', 'units' => 2];
        $this->postJson('/api/wallet/command', $input)->assertOk()->assertJsonPath('data.required', 2)->assertJsonPath('data.wallet.available_balance', 80);
        $input['transaction_id'] = (string) Str::uuid();
        $this->postJson('/api/wallet/command', $input)->assertOk()->assertJsonPath('data.wallet.available_balance', 78)->assertJsonPath('data.wallet.reserved_balance', 20);
        $this->postJson('/api/wallet/command', $input)->assertOk()->assertJsonPath('data.wallet.available_balance', 78)->assertJsonPath('data.replayed', true);
        $this->postJson('/api/wallet/command', [...$input, 'units' => 3])->assertConflict();
        $this->assertSame(1, DB::table('nb_wallet_entries')->where('transaction_id', $input['transaction_id'])->count());
        $this->assertDatabaseHas('nb_online_wallets', ['software_license_id' => $license->id, 'balance' => 98, 'reserved_balance' => 20]);
        $this->postJson('/api/wallet/command', ['command' => 'NBFOOTING', 'units' => 79, 'transaction_id' => (string) Str::uuid()])->assertConflict();
        $this->getJson('/api/wallet/history')->assertOk()->assertJsonPath('data.0.source', 'online_command')->assertJsonPath('data.0.amount', 2);
    }

    public function test_online_command_rejects_unknown_commands_and_blocked_or_unpaired_devices(): void
    {
        [$license] = $this->connected();
        $input = ['command' => 'NBFOOTING', 'units' => 2, 'transaction_id' => (string) Str::uuid()];
        $this->postJson('/api/wallet/command', [...$input, 'command' => 'FORGED'])->assertUnprocessable();
        DB::table('nb_online_wallets')->where('software_license_id', $license->id)->update(['status' => 'blocked']);
        $this->postJson('/api/wallet/command', $input)->assertForbidden();
        $this->withToken('invalid-device')->postJson('/api/wallet/command', $input)->assertUnauthorized();
        $this->assertSame(100, (int) DB::table('nb_online_wallets')->where('software_license_id', $license->id)->value('balance'));
    }

    public function test_balance_identity_is_the_confirmed_device_owner_and_selected_license(): void
    {
        [$license, $pair, $user] = $this->connected();
        $device = DB::table('nb_devices')->where('secret_hash', hash('sha256', $pair['secret']))->first();
        $this->getJson('/api/wallet/balance')->assertOk()
            ->assertJsonPath('data.identity.email', $user->email)
            ->assertJsonPath('data.identity.license_code', $license->license_code)
            ->assertJsonPath('data.identity.device_id', $device->id)
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->withToken('not-the-confirmed-device')->getJson('/api/wallet/balance')->assertUnauthorized();
    }

    private function batch(string $lease, int $version = 1, int $sequence = 1): array
    {
        return ['request_id' => (string) Str::uuid(), 'lease_id' => $lease, 'expected_version' => $version, 'transactions' => [['transaction_id' => (string) Str::uuid(), 'sequence' => $sequence, 'command' => 'NBFOOTING', 'units' => 2, 'occurred_at' => '2026-09-15T10:00:00Z']]];
    }

    public function test_connect_signs_and_reserves_once_and_replays_identical_response(): void
    {
        $this->connected();
        $input = ['request_id' => (string) Str::uuid(), 'expected_version' => 0, 'requested_allowance' => 20];
        $response = $this->postJson('/api/wallet/connect', $input)->assertOk()->assertJsonPath('data.wallet.available_balance', 80)->assertJsonPath('data.wallet.reserved_balance', 20)->json();
        $this->postJson('/api/wallet/connect', array_reverse($input, true))->assertOk()->assertExactJson($response);
        $this->postJson('/api/wallet/connect', [...$input, 'requested_allowance' => 30])->assertConflict();
        $parts = explode('.', $response['data']['lease']['grant']);
        $decode = fn ($s) => base64_decode(strtr($s, '-_', '+/'));
        $public = openssl_pkey_get_details(openssl_pkey_get_private(file_get_contents(self::$keyPath)))['key'];
        $this->assertSame(1, openssl_verify($parts[0].'.'.$parts[1], $decode($parts[2]), $public, OPENSSL_ALGO_SHA256));
        $payload = json_decode($decode($parts[1]), true);
        $this->assertSame(20, $payload['allowance']);
        $this->assertArrayNotHasKey('connect_response', $payload['policy']);
        $this->assertDatabaseCount('nb_wallet_leases', 1);
        $this->assertDatabaseCount('nb_wallet_entries', 0);
    }

    public function test_sync_settles_once_using_snapshot_and_history_is_private(): void
    {
        [$license] = $this->connected();
        $lease = $this->connect()['data']['lease']['id'];
        config(['online_wallet.commands.NBFOOTING.cost' => 99]);
        $input = $this->batch($lease);
        $response = $this->postJson('/api/wallet/sync', $input)->assertOk()->assertJsonPath('data.wallet.available_balance', 80)->assertJsonPath('data.wallet.reserved_balance', 18)->assertJsonPath('data.wallet.version', 2)->json();
        $this->postJson('/api/wallet/sync', $input)->assertOk()->assertExactJson($response);
        $this->assertDatabaseHas('nb_online_wallets', ['software_license_id' => $license->id, 'balance' => 98]);
        $this->assertDatabaseCount('nb_wallet_entries', 1);
        $this->assertDatabaseCount('nb_wallet_syncs', 1);
        $this->getJson('/api/wallet/history')->assertOk()->assertJsonPath('data.0.amount', 2)->assertJsonPath('data.0.source', 'offline_usage');
        $this->getJson('/api/wallet/balance')->assertOk()->assertJsonPath('data.wallet.version', 2);
        $changed = $input;
        $changed['transactions'][0]['units'] = 3;
        $this->postJson('/api/wallet/sync', $changed)->assertConflict();
    }

    public function test_admin_sync_history_is_scoped_paginated_and_omits_payloads(): void
    {
        [$license] = $this->connected();
        $lease = $this->connect()['data']['lease']['id'];
        $input = $this->batch($lease);
        $this->postJson('/api/wallet/sync', $input)->assertOk();
        $this->withHeader('Authorization', '')->actingAs($this->userWithRole(Role::Admin));
        $this->getJson("/api/v1/admin/wallets/{$license->id}")->assertOk()
            ->assertJsonCount(1, 'data.syncs')
            ->assertJsonPath('data.syncs.0.request_id', $input['request_id'])
            ->assertJsonPath('data.syncs.0.accepted_count', 1)
            ->assertJsonPath('meta.sync_page', 1)
            ->assertJsonMissingPath('data.syncs.0.response')
            ->assertJsonMissingPath('data.syncs.0.request_hash');
        $this->getJson("/api/v1/admin/wallets/{$license->id}?sync_page=2")->assertOk()->assertJsonCount(0, 'data.syncs');
        $this->getJson("/api/v1/admin/wallets/{$license->id}?sync_page=0")->assertUnprocessable();
        $other = $this->license($this->customer());
        DB::table('nb_online_wallets')->insert(['software_license_id' => $other->id, 'balance' => 100, 'created_at' => now(), 'updated_at' => now()]);
        $this->getJson("/api/v1/admin/wallets/{$other->id}")->assertOk()->assertJsonCount(0, 'data.syncs');
    }

    public function test_late_invalid_entry_rolls_back_entire_batch(): void
    {
        $this->connected();
        $lease = $this->connect()['data']['lease']['id'];
        $input = $this->batch($lease);
        $input['transactions'][] = ['transaction_id' => (string) Str::uuid(), 'sequence' => 2, 'command' => 'UNKNOWN', 'units' => 1, 'occurred_at' => '2026-09-15T10:00:00Z'];
        $this->postJson('/api/wallet/sync', $input)->assertUnprocessable();
        $this->assertDatabaseCount('nb_wallet_entries', 0);
        $this->assertDatabaseHas('nb_online_wallets', ['balance' => 100, 'reserved_balance' => 20, 'version' => 1]);
        $this->assertDatabaseHas('nb_wallet_leases', ['id' => $lease, 'consumed' => 0, 'last_sequence' => 0]);
    }

    public function test_stale_version_duplicate_transaction_and_sequence_gap_are_rejected(): void
    {
        $this->connected();
        $lease = $this->connect()['data']['lease']['id'];
        $this->postJson('/api/wallet/sync', $this->batch($lease, 0))->assertConflict();
        $this->postJson('/api/wallet/sync', $this->batch($lease, 1, 2))->assertConflict();
        $input = $this->batch($lease);
        $this->postJson('/api/wallet/sync', $input)->assertOk();
        $input['request_id'] = (string) Str::uuid();
        $input['expected_version'] = 2;
        $input['transactions'][0]['sequence'] = 2;
        $this->postJson('/api/wallet/sync', $input)->assertConflict();
        $this->assertDatabaseCount('nb_wallet_entries', 1);
    }

    public function test_wrong_device_cannot_settle_or_read_another_wallet(): void
    {
        [$license] = $this->connected();
        $lease = $this->connect()['data']['lease']['id'];
        [$other] = $this->connected();
        $this->postJson('/api/wallet/sync', $this->batch($lease))->assertForbidden();
        $this->getJson('/api/wallet/balance')->assertOk()->assertJsonPath('data.wallet.license_id', $other->id);
        $this->getJson('/api/wallet/history')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/wallet/history?license_id='.$license->id)->assertUnprocessable();
    }

    public function test_expiry_and_overdraw_do_not_release_or_spend_reservations(): void
    {
        $this->connected();
        $lease = $this->connect(1)['data']['lease']['id'];
        $this->postJson('/api/wallet/sync', $this->batch($lease))->assertConflict();
        $this->travel(25)->hours();
        $this->postJson('/api/wallet/sync', $this->batch($lease))->assertConflict();
        $this->assertDatabaseHas('nb_online_wallets', ['balance' => 100, 'reserved_balance' => 1]);
        $this->assertDatabaseCount('nb_wallet_entries', 0);
    }

    public function test_revoked_license_suspended_user_and_released_binding_are_blocked(): void
    {
        [$license, , $user] = $this->connected();
        $license->update(['status' => LicenseStatus::Revoked]);
        $this->getJson('/api/wallet/balance')->assertForbidden();
        $license->update(['status' => LicenseStatus::Issued]);
        $user->update(['status' => 'suspended']);
        $this->getJson('/api/wallet/history')->assertForbidden();
        $user->update(['status' => 'active']);
        $license->machineBindings()->update(['released_at' => now()]);
        $this->getJson('/api/wallet/balance')->assertForbidden();
    }

    public function test_missing_key_and_validation_fail_without_reserving_funds(): void
    {
        $this->connected();
        config(['offline_wallet.signing_key_path' => null]);
        $input = ['request_id' => (string) Str::uuid(), 'expected_version' => 0, 'requested_allowance' => 20];
        $this->postJson('/api/wallet/connect', $input)->assertStatus(503);
        $this->postJson('/api/wallet/connect', [...$input, 'balance' => 100000])->assertUnprocessable();
        $this->postJson('/api/wallet/connect', [...$input, 'requested_allowance' => -1])->assertUnprocessable();
        $this->assertDatabaseHas('nb_online_wallets', ['balance' => 100, 'reserved_balance' => 0]);
        $this->assertDatabaseCount('nb_wallet_leases', 0);
    }

    public function test_unknown_credentials_and_blocked_wallet_are_rejected(): void
    {
        [$license] = $this->connected();
        DB::table('nb_online_wallets')->where('software_license_id', $license->id)->update(['status' => 'blocked']);
        $this->getJson('/api/wallet/balance')->assertForbidden();
        $this->withToken(str_repeat('f', 64))->getJson('/api/wallet/history')->assertUnauthorized();
    }

    public function test_legacy_spending_cannot_bypass_offline_reservation(): void
    {
        $this->connected();
        $this->connect();
        $this->postJson('/api/v1/licensing/wallet/operation', ['command' => 'NBFOOTING', 'units' => 2, 'operation_id' => (string) Str::uuid()])->assertConflict();
        $this->assertDatabaseHas('nb_online_wallets', ['balance' => 100, 'reserved_balance' => 20]);
    }

    public function test_daily_pricing_is_bound_to_server_lease_day(): void
    {
        $this->connected();
        $lease = $this->connect()['data']['lease']['id'];
        $input = $this->batch($lease);
        $input['transactions'][0]['command'] = 'RM';
        $input['transactions'][0]['units'] = 1;
        $input['transactions'][] = [...$input['transactions'][0], 'transaction_id' => (string) Str::uuid(), 'sequence' => 2, 'occurred_at' => '2030-01-01T00:00:00Z'];
        $this->postJson('/api/wallet/sync', $input)->assertOk()->assertJsonPath('data.lease_remaining', 19);
        $this->assertDatabaseHas('nb_online_wallets', ['balance' => 99]);
        $this->getJson('/api/wallet/history?limit=1')->assertOk()
            ->assertJsonPath('data.0.amount', 0)->assertJsonPath('data.0.type', 'debit');
    }

    public function test_rejected_batch_is_audited_and_same_id_cannot_change_payload(): void
    {
        $this->connected();
        $lease = $this->connect(1)['data']['lease']['id'];
        $input = $this->batch($lease);
        $this->postJson('/api/wallet/sync', $input)->assertConflict();
        $this->postJson('/api/wallet/sync', $input)->assertConflict();
        $this->assertDatabaseCount('nb_wallet_syncs', 1);
        $this->assertDatabaseHas('nb_wallet_syncs', ['request_id' => $input['request_id'], 'status' => 'rejected']);
        $input['transactions'][0]['units'] = 1;
        $this->postJson('/api/wallet/sync', $input)->assertConflict();
        $this->assertDatabaseCount('nb_wallet_entries', 0);
    }

    public function test_exhausted_lease_can_be_replaced_but_active_lease_cannot(): void
    {
        $this->connected();
        $lease = $this->connect(2)['data']['lease']['id'];
        $this->postJson('/api/wallet/connect', ['request_id' => (string) Str::uuid(), 'expected_version' => 1, 'requested_allowance' => 2])->assertConflict();
        $this->postJson('/api/wallet/sync', $this->batch($lease))->assertOk()->assertJsonPath('data.lease_remaining', 0);
        $this->postJson('/api/wallet/connect', ['request_id' => (string) Str::uuid(), 'expected_version' => 2, 'requested_allowance' => 2])->assertOk()->assertJsonPath('data.wallet.version', 3);
    }

    public function test_cookie_login_alone_does_not_authenticate_a_device_and_pagination_is_bounded(): void
    {
        [, , $user] = $this->connected();
        $this->withHeader('Authorization', '')->actingAs($user)->getJson('/api/wallet/balance')->assertUnauthorized();
        $this->connected();
        $this->getJson('/api/wallet/history?limit=101')->assertUnprocessable();
        $this->getJson('/api/wallet/history?cursor=not-a-cursor')->assertUnprocessable();
    }

    public function test_deleted_user_cannot_use_a_previously_confirmed_device(): void
    {
        [, , $user] = $this->connected();
        $user->delete();
        $this->getJson('/api/wallet/balance')->assertForbidden();
    }

    public function test_settled_transaction_with_new_request_id_returns_receipt_without_second_debit(): void
    {
        [$license] = $this->connected();
        $lease = $this->connect()['data']['lease']['id'];
        $input = $this->batch($lease);
        $this->postJson('/api/wallet/sync', $input)->assertOk();
        $input['request_id'] = (string) Str::uuid();

        $receipt = $this->postJson('/api/wallet/sync', $input)->assertOk()->assertJsonPath('data.replayed', true)->assertJsonPath('data.wallet.version', 2)->json();
        $this->postJson('/api/wallet/sync', $input)->assertOk()->assertExactJson($receipt);
        $this->assertDatabaseCount('nb_wallet_entries', 1);
        $this->assertDatabaseHas('nb_online_wallets', ['software_license_id' => $license->id, 'balance' => 98, 'reserved_balance' => 18]);
        $input['request_id'] = (string) Str::uuid();
        $input['transactions'][0]['units'] = 3;
        $this->postJson('/api/wallet/sync', $input)->assertConflict();
        $this->assertDatabaseCount('nb_wallet_entries', 1);
    }

    public function test_first_pc_activates_and_second_pc_is_rejected_until_audited_reset(): void
    {
        [$license, $old, $user] = $this->connected();
        $lease = $this->connect()['data']['lease']['id'];
        $license->update(['device_limit' => 2]);
        $this->assertSame(LicenseStatus::Active, $license->fresh()->status);
        $second = app(OnlineLicensingService::class)->pair('SECOND-PC-112233445566');
        $this->withHeader('Authorization', '')->actingAs($user)
            ->postJson('/api/v1/account/connect-device', ['code' => $second['code'], 'license_code' => $license->license_code])->assertConflict();
        $this->assertSame(1, $license->machineBindings()->whereNull('released_at')->count());
        $admin = $this->userWithRole(Role::Admin);
        $action = ['transaction_id' => (string) Str::uuid(), 'expected_version' => 1, 'action' => 'reset_device', 'reason' => 'Test replacement', 'reference_note' => 'CASE-RESET'];

        $response = $this->actingAs($admin)->postJson('/api/v1/admin/wallets/'.$license->id.'/actions', $action)->assertOk()->assertJsonPath('data.reserved_balance', 20)->json();
        $this->postJson('/api/v1/admin/wallets/'.$license->id.'/actions', $action)->assertOk()->assertExactJson($response);
        $this->assertDatabaseHas('nb_wallet_leases', ['id' => $lease, 'status' => 'review_required']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'device.reset', 'user_id' => $admin->id]);
        $this->withToken($old['secret'])->getJson('/api/wallet/balance')->assertForbidden();
        $this->withHeader('Authorization', '')->actingAs($user)
            ->postJson('/api/v1/account/connect-device', ['code' => $second['code'], 'license_code' => $license->license_code])->assertOk();
        $this->withToken($second['secret'])->getJson('/api/wallet/balance')->assertOk();
        $this->withToken($old['secret'])->getJson('/api/wallet/balance')->assertForbidden();
        $this->assertSame(2, $license->machineBindings()->count());
        $this->assertSame(1, $license->machineBindings()->whereNull('released_at')->count());
    }

    public function test_license_suspension_block_and_activation_are_audited_without_changing_balance(): void
    {
        [$license, $device] = $this->connected();
        $admin = $this->userWithRole(Role::Admin);
        foreach (['suspended', 'blocked', 'active'] as $version => $status) {
            $this->withHeader('Authorization', '')->actingAs($admin)->postJson('/api/v1/admin/wallets/'.$license->id.'/actions', [
                'transaction_id' => (string) Str::uuid(), 'expected_version' => $version, 'action' => 'license_status', 'status' => $status,
                'reason' => 'License review', 'reference_note' => 'CASE-LICENSE',
            ])->assertOk()->assertJsonPath('data.balance', 100);
            $response = $this->withToken($device['secret'])->getJson('/api/wallet/balance');
            $status === 'active' ? $response->assertOk() : $response->assertForbidden();
            $this->assertDatabaseHas('audit_logs', ['action' => 'license.'.$status, 'user_id' => $admin->id]);
        }
        $this->assertDatabaseCount('nb_wallet_entries', 3);
        $this->assertDatabaseHas('nb_online_wallets', ['software_license_id' => $license->id, 'balance' => 100]);
    }
}
