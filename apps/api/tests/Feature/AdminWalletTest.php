<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Permission;
use App\Models\SoftwareLicense;
use App\Services\Licensing\OfflineWalletLedger;
use App\Services\Licensing\OnlineWalletService;
use Database\Seeders\WalletPermissionSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Tests\TestCase;

class AdminWalletTest extends TestCase
{
    use RefreshDatabase;

    private function wallet(): int
    {
        $user = $this->customer();
        $order = Order::factory()->for($user)->paid()->create();
        $item = $order->items()->create(['product_type' => 'software_license', 'product_name' => 'NB Tools', 'variant_name' => 'Single', 'sku' => 'NBET-V6-SINGLE', 'quantity' => 1, 'unit_price_minor' => 100, 'line_total_minor' => 100]);
        $license = SoftwareLicense::create(['license_code' => 'NB-'.Str::uuid(), 'user_id' => $user->id, 'order_id' => $order->id, 'order_item_id' => $item->id, 'product_name' => 'NB Tools', 'status' => 'issued', 'device_limit' => 1, 'issued_at' => now()]);
        DB::table('nb_online_wallets')->insert(['software_license_id' => $license->id, 'balance' => 100, 'reserved_balance' => 20, 'created_at' => now(), 'updated_at' => now()]);

        return $license->id;
    }

    private function action(array $override = []): array
    {
        return [...['transaction_id' => (string) Str::uuid(), 'expected_version' => 0, 'action' => 'add', 'amount' => 10, 'reason' => 'Correction after review', 'reference_note' => 'Review #123'], ...$override];
    }

    public function test_customer_wallet_history_is_read_only_owned_and_excludes_device_credentials(): void
    {
        $id = $this->wallet();
        $license = SoftwareLicense::findOrFail($id);
        $url = '/api/v1/account/licenses/'.$license->license_code.'/wallet';
        $this->getJson($url)->assertUnauthorized();
        $this->actingAs($this->customer())->getJson($url)->assertNotFound();
        $this->actingAs($license->user)->getJson($url)->assertOk()
            ->assertJsonPath('data.wallet.available_balance', 80)
            ->assertJsonPath('data.license_code', $license->license_code)
            ->assertJsonMissingPath('data.secret_hash');
        $this->postJson('/api/v1/admin/wallets/'.$id.'/actions', $this->action())->assertForbidden();
        $this->assertDatabaseCount('nb_wallet_entries', 0);
    }

    public function test_admin_adjustment_is_atomic_audited_and_idempotent(): void
    {
        $id = $this->wallet();
        $admin = $this->userWithRole(Role::Admin);
        $this->actingAs($admin);
        $input = $this->action();
        $response = $this->postJson("/api/v1/admin/wallets/$id/actions", $input)->assertOk()->assertJsonPath('data.balance', 110)->assertJsonPath('data.available_balance', 90)->json();
        $this->postJson("/api/v1/admin/wallets/$id/actions", array_reverse($input, true))->assertOk()->assertExactJson($response);
        $this->postJson("/api/v1/admin/wallets/$id/actions", [...$input, 'amount' => 11])->assertConflict();
        $this->assertDatabaseCount('nb_wallet_entries', 1);
        $this->assertDatabaseHas('nb_wallet_entries', ['created_by' => $admin->id, 'action_type' => 'admin_credit', 'reason' => $input['reason'], 'reference_note' => $input['reference_note']]);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'action' => 'wallet.admin_credit']);
    }

    public function test_reserved_tokens_stale_version_and_invalid_inputs_are_protected(): void
    {
        $id = $this->wallet();
        $this->actingAs($this->userWithRole(Role::Admin));
        foreach ([$this->action(['action' => 'deduct', 'amount' => 81]), $this->action(['expected_version' => 1])] as $input) {
            $this->postJson("/api/v1/admin/wallets/$id/actions", $input)->assertConflict();
        }
        foreach ([['amount' => 0], ['amount' => 1.5], ['reason' => ''], ['reference_note' => ''], ['created_by' => 1], ['balance' => 9000]] as $invalid) {
            $this->postJson("/api/v1/admin/wallets/$id/actions", $this->action($invalid))->assertUnprocessable();
        }
        $this->postJson("/api/v1/admin/wallets/$id/actions", $this->action(['action' => 'deduct', 'amount' => 80]))->assertOk()->assertJsonPath('data.balance', 20)->assertJsonPath('data.reserved_balance', 20);
        $this->assertDatabaseCount('nb_wallet_entries', 1);
        $this->assertDatabaseHas('nb_wallet_entries', ['action_type' => 'admin_debit', 'delta' => -80]);
    }

    public function test_status_transitions_are_zero_amount_entries_and_block_adjustments(): void
    {
        $id = $this->wallet();
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        foreach (['suspended', 'blocked', 'active'] as $version => $status) {
            $input = $this->action(['action' => 'status', 'status' => $status, 'expected_version' => $version]);
            unset($input['amount']);
            $this->postJson("/api/v1/admin/wallets/$id/actions", $input)->assertOk()->assertJsonPath('data.balance', 100)->assertJsonPath('data.status', $status);
            if ($status !== 'active') {
                $this->postJson("/api/v1/admin/wallets/$id/actions", $this->action(['expected_version' => $version + 1]))->assertConflict();
            }
        }
        $this->assertDatabaseCount('nb_wallet_entries', 3);
        $this->assertDatabaseHas('nb_wallet_entries', ['action_type' => 'admin_status_change', 'delta' => 0, 'status_before' => 'blocked', 'status_after' => 'active']);
    }

    public function test_staff_role_does_not_replace_permission_checks(): void
    {
        $id = $this->wallet();
        $this->getJson('/api/v1/admin/wallets')->assertUnauthorized();
        foreach ([Role::Customer, Role::Support, Role::Editor] as $role) {
            $this->actingAs($this->userWithRole($role));
            $this->getJson('/api/v1/admin/wallets')->assertForbidden();
            $this->postJson("/api/v1/admin/wallets/$id/actions", $this->action())->assertForbidden();
        }
        $support = $this->userWithRole(Role::Support);
        $role = \App\Models\Role::where('name', 'support')->firstOrFail();
        $role->permissions()->attach(Permission::where('name', 'wallets.view')->value('id'));
        $this->actingAs($support->fresh());
        $this->getJson("/api/v1/admin/wallets/$id")->assertOk()->assertJsonPath('data.can_manage', false);
        $this->postJson("/api/v1/admin/wallets/$id/actions", $this->action())->assertForbidden();
    }

    public function test_search_and_details_include_history_without_device_secrets(): void
    {
        $id = $this->wallet();
        $this->wallet();
        $this->actingAs($this->userWithRole(Role::Admin));
        $license = SoftwareLicense::findOrFail($id);
        $device = DB::table('nb_devices')->insertGetId(['software_license_id' => $id, 'secret_hash' => hash('sha256', 'test-secret'), 'pair_hash' => hash('sha256', 'test-pair'), 'machine_encrypted' => 'test-only', 'machine_hash' => hash('sha256', 'test-machine'), 'expires_at' => now()->addDay(), 'confirmed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        $this->getJson('/api/v1/admin/wallets?q='.urlencode($license->license_code))->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/wallets?q='.urlencode($license->user->email))->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/v1/admin/wallets/$id/actions", $this->action())->assertOk();
        $this->getJson("/api/v1/admin/wallets/$id")->assertOk()->assertJsonCount(1, 'data.entries')->assertJsonPath('data.wallet.available_balance', 90)->assertJsonMissingPath('data.entries.0.request_hash')->assertJsonMissingPath('data.entries.0.action_response');
        $this->getJson("/api/v1/admin/wallets/$id")->assertOk()->assertJsonPath('data.devices.0.id', $device)->assertJsonPath('data.devices.0.last_sync_status', null)->assertJsonMissingPath('data.devices.0.secret_hash')->assertJsonMissingPath('data.devices.0.machine_encrypted');
        $this->getJson('/api/v1/admin/wallets/999999')->assertNotFound();
        $this->getJson('/api/v1/admin/wallets?page=-1')->assertUnprocessable();
    }

    public function test_existing_transaction_cannot_be_reused_by_other_admin_or_wallet(): void
    {
        $id = $this->wallet();
        $other = $this->wallet();
        $input = $this->action();
        $this->actingAs($this->userWithRole(Role::Admin));
        $this->postJson("/api/v1/admin/wallets/$id/actions", $input)->assertOk();
        $this->postJson("/api/v1/admin/wallets/$other/actions", $input)->assertConflict();
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->postJson("/api/v1/admin/wallets/$id/actions", $input)->assertConflict();
    }

    public function test_audit_failure_rolls_back_entry_and_balance(): void
    {
        $id = $this->wallet();
        $this->actingAs($this->userWithRole(Role::Admin));
        AuditLog::creating(function () {
            throw new \RuntimeException('Simulated audit failure');
        });
        try {
            $this->postJson("/api/v1/admin/wallets/$id/actions", $this->action())->assertStatus(500);
            $this->assertDatabaseCount('nb_wallet_entries', 0);
            $this->assertDatabaseHas('nb_online_wallets', ['software_license_id' => $id, 'balance' => 100, 'version' => 0]);
        } finally {
            AuditLog::flushEventListeners();
        }
    }

    public function test_permission_seeder_keeps_existing_role_grants(): void
    {
        $this->seedRoles();
        $before = DB::table('permission_role')->count();
        $this->seed(WalletPermissionSeeder::class);
        $this->seed(WalletPermissionSeeder::class);
        $this->assertSame($before, DB::table('permission_role')->count());
    }

    public function test_stateful_admin_mutation_requires_csrf_protection(): void
    {
        $id = $this->wallet();
        $this->actingAs($this->userWithRole(Role::Admin));
        $middleware = config('sanctum.middleware.validate_csrf_token', VerifyCsrfToken::class);
        $this->app->bind($middleware, fn ($app) => new class($app, $app['encrypter']) extends VerifyCsrfToken
        {
            protected function runningUnitTests(): bool
            {
                return false;
            }
        });
        $this->postJson("/api/v1/admin/wallets/$id/actions", $this->action())->assertStatus(419);
        $this->withSession(['_token' => 'wallet-test-csrf'])->withHeader('X-CSRF-TOKEN', 'wallet-test-csrf')
            ->postJson("/api/v1/admin/wallets/$id/actions", $this->action())->assertOk();
    }

    public function test_service_boundary_uses_the_authenticated_admin_and_protects_legacy_spending(): void
    {
        $id = $this->wallet();
        $admin = $this->userWithRole(Role::Admin);
        $this->actingAs($admin);
        $ledger = app(OfflineWalletLedger::class);
        $result = $ledger->adjust($id, (string) Str::uuid(), 'credit', 5, 'admin_adjustment', $admin->id, 'Reviewed correction', 0, 'CASE-5');
        $this->assertSame(105, $result['data']['balance']);
        $input = $this->action(['action' => 'status', 'status' => 'blocked', 'expected_version' => 1]);
        unset($input['amount']);
        $this->postJson("/api/v1/admin/wallets/$id/actions", $input)->assertOk();
        try {
            app(OnlineWalletService::class)->operation(SoftwareLicense::findOrFail($id), 'NBFOOTING', 1, (string) Str::uuid());
            $this->fail('Blocked wallet spent through legacy service.');
        } catch (HttpExceptionInterface $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
        $this->assertDatabaseHas('nb_online_wallets', ['software_license_id' => $id, 'balance' => 105]);
    }
}
