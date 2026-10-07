<?php

namespace Tests\Feature;

use App\Enums\LicenseStatus;
use App\Models\Order;
use App\Models\SoftwareLicense;
use App\Services\Licensing\OfflineWalletLedger;
use App\Services\Licensing\OfflineWalletPolicy;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OfflineWalletFoundationTest extends TestCase
{
    use RefreshDatabase;

    private function license($user, bool $paid = true): SoftwareLicense
    {
        $order = $paid ? Order::factory()->for($user)->paid()->create() : Order::factory()->for($user)->create();
        $item = $order->items()->create(['product_type' => 'software_license', 'product_name' => 'NB Tools', 'variant_name' => 'Single', 'sku' => 'NBET-V6-SINGLE', 'quantity' => 1, 'unit_price_minor' => 100, 'line_total_minor' => 100]);

        return SoftwareLicense::create(['license_code' => 'NB-'.bin2hex(random_bytes(8)), 'user_id' => $user->id, 'order_id' => $order->id, 'order_item_id' => $item->id, 'product_name' => 'NB Tools', 'status' => LicenseStatus::Issued, 'device_limit' => 1, 'issued_at' => now()]);
    }

    private function wallet(): int
    {
        $license = $this->license($this->customer());
        DB::table('nb_online_wallets')->insert(['software_license_id' => $license->id, 'balance' => 100, 'created_at' => now(), 'updated_at' => now()]);

        return $license->id;
    }

    public function test_legacy_storage_remains_compatible_and_available_is_not_a_second_balance(): void
    {
        $id = $this->wallet();
        $wallet = DB::table('nb_online_wallets')->first();
        $this->assertSame($id, $wallet->license_id);
        $this->assertSame(100, $wallet->available_balance);
        DB::table('nb_online_wallets')->where('software_license_id', $id)->update(['reserved_balance' => 30]);
        $wallet = DB::table('nb_online_wallets')->first();
        $this->assertSame(100, $wallet->balance);
        $this->assertSame(70, $wallet->available_balance);
        DB::table('nb_wallet_entries')->insert(['software_license_id' => $id, 'reference' => 'legacy-entry', 'delta' => -5, 'balance' => 95, 'created_at' => now()]);
        $entry = DB::table('nb_wallet_entries')->first();
        $this->assertSame(-5, $entry->delta);
        $this->assertSame('debit', $entry->entry_type);
        $this->assertSame(5, $entry->amount);
        $this->assertNull($entry->transaction_id);
    }

    public function test_new_transaction_ids_are_unique(): void
    {
        $id = $this->wallet();
        $entry = ['software_license_id' => $id, 'reference' => 'one', 'delta' => 1, 'balance' => 101, 'transaction_id' => '0da5e418-a47c-40ea-a2ad-edc6bff61913', 'source' => 'admin_adjustment', 'created_at' => now()];
        DB::table('nb_wallet_entries')->insert($entry);
        $this->expectException(QueryException::class);
        DB::table('nb_wallet_entries')->insert([...$entry, 'reference' => 'two']);
    }

    public function test_cannot_reserve_more_than_settled_balance(): void
    {
        $id = $this->wallet();
        $this->expectException(QueryException::class);
        DB::table('nb_online_wallets')->where('software_license_id', $id)->update(['reserved_balance' => 101]);
    }

    public function test_new_tables_have_required_foreign_keys_and_duplicate_guards(): void
    {
        $this->assertTrue(Schema::hasColumns('nb_wallet_leases', ['device_id', 'allowance', 'consumed', 'released', 'expires_at', 'sync_due_at', 'policy_version']));
        $this->assertTrue(Schema::hasColumns('nb_wallet_syncs', ['request_id', 'request_hash', 'response', 'expected_version', 'result_version']));
        $this->assertCount(2, Schema::getForeignKeys('nb_wallet_leases'));
        $this->assertCount(3, Schema::getForeignKeys('nb_wallet_syncs'));
        foreach (['nb_wallet_leases', 'nb_wallet_syncs'] as $table) {
            $index = collect(Schema::getIndexes($table))->first(fn ($index) => $index['columns'] === ['device_id', 'request_id']);
            $this->assertTrue($index['unique']);
        }
    }

    public function test_migration_dry_run_has_no_data_rewrites_and_conflicts_fail_before_ddl(): void
    {
        $migration = require database_path('migrations/2026_09_15_083032_extend_nb_wallet_for_offline_sync.php');
        $queries = DB::pretend(fn () => $migration->up());
        $this->assertNotEmpty($queries);
        foreach ($queries as $query) {
            $this->assertDoesNotMatchRegularExpression('/^\s*(insert|update|delete|replace|truncate)\b/i', $query['query']);
        }
        $this->expectException(\LogicException::class);
        $this->expectExceptionMessage('Wallet schema conflict');
        $migration->up();
    }

    public function test_history_cannot_be_removed_by_automatic_rollback(): void
    {
        $migration = require database_path('migrations/2026_09_15_083032_extend_nb_wallet_for_offline_sync.php');
        $this->expectException(\LogicException::class);
        $migration->down();
    }

    public function test_api_is_registered_but_feature_remains_disabled(): void
    {
        $this->assertFalse(config('offline_wallet.enabled'));
        $this->assertTrue(app()->bound(OfflineWalletLedger::class));
        $this->getJson('/api/wallet/balance')->assertStatus(503);
        $policy = OfflineWalletPolicy::configured();
        $this->assertSame(100, $policy->maxAllowance);
        $this->assertSame(21600, $policy->syncIntervalSeconds);
    }

    public function test_invalid_policy_is_rejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new OfflineWalletPolicy(1, 100, 3600, 7200, 100);
    }
}
