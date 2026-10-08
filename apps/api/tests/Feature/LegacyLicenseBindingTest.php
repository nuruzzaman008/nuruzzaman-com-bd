<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\SoftwareLicense;
use App\Services\Licensing\OnlineLicensingService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class LegacyLicenseBindingTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/licenses/bind-existing';

    private function input(string $email): array
    {
        config(['online_wallet.enabled' => true, 'online_licensing.enabled' => true, 'offline_wallet.enabled' => true]);

        return ['email' => $email, 'license_code' => 'NB-202608-61FC41C2', 'reason' => 'Verified original vendor license record', 'reference' => 'SUPPORT-123', 'ownership_verified' => true];
    }

    public function test_import_is_audited_retry_safe_and_does_not_create_or_approve_payment(): void
    {
        $user = $this->customer();
        $order = Order::factory()->for($user)->create(['status' => 'pending_payment']);
        $admin = $this->userWithRole(Role::Admin);
        $input = $this->input($user->email);
        $this->actingAs($admin)->postJson(self::URL, $input)->assertOk()->assertJsonPath('data.already_bound', false);
        $this->postJson(self::URL, $input)->assertOk()->assertJsonPath('data.already_bound', true);
        $this->assertDatabaseCount('software_licenses', 1);
        $this->assertDatabaseCount('nb_legacy_license_imports', 1);
        $this->assertDatabaseCount('nb_wallet_entries', 1);
        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseCount('orders', 1);
        $this->assertSame('pending_payment', $order->fresh()->status->value);
        $this->assertDatabaseHas('nb_online_wallets', ['balance' => 0, 'reserved_balance' => 0]);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'action' => 'license.legacy_bound']);
        $this->assertDatabaseHas('nb_legacy_license_imports', ['created_by' => $admin->id, 'user_id' => $user->id, 'reference' => 'SUPPORT-123']);
        $this->actingAs($user)->getJson('/api/v1/account/licenses')->assertOk()->assertJsonPath('data.0.license_code', $input['license_code']);
    }

    public function test_import_can_pair_and_use_wallet_api_without_a_fake_order(): void
    {
        $user = $this->customer();
        $input = $this->input($user->email);
        $admin = $this->userWithRole(Role::SuperAdmin);
        $this->actingAs($admin)->postJson(self::URL, $input)->assertOk();
        $pair = app(OnlineLicensingService::class)->pair('AABBCCDDEEFF11223344');
        $this->actingAs($user)->postJson('/api/v1/account/connect-device', ['code' => $pair['code'], 'license_code' => $input['license_code']])->assertOk();
        $this->withToken($pair['secret'])->getJson('/api/wallet/balance')->assertOk()->assertJsonPath('data.wallet.available_balance', 0)->assertJsonPath('data.identity.email', $user->email);
        $this->getJson('/api/wallet/history')->assertOk();
        $license = SoftwareLicense::firstOrFail();
        $this->actingAs($admin)->postJson('/api/v1/admin/wallets/'.$license->id.'/actions', ['transaction_id' => (string) Str::uuid(), 'expected_version' => 1, 'action' => 'add', 'amount' => 50, 'reason' => 'Approved opening offer', 'reference_note' => 'OFFER-50'])->assertOk()->assertJsonPath('data.balance', 50);
        $this->actingAs($user)->withToken($pair['secret'])->getJson('/api/wallet/balance')->assertOk()->assertJsonPath('data.wallet.available_balance', 50);
        $license->update(['status' => 'suspended']);
        $this->getJson('/api/wallet/balance')->assertForbidden();
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_import_rejects_transfers_and_does_not_reset_existing_wallet(): void
    {
        $one = $this->customer();
        $two = $this->customer();
        $input = $this->input($one->email);
        $this->actingAs($this->userWithRole(Role::Admin))->postJson(self::URL, $input)->assertOk();
        $license = SoftwareLicense::firstOrFail();
        $license->update(['status' => 'suspended']);
        $this->postJson(self::URL, [...$input, 'email' => $two->email])->assertConflict();
        $this->postJson(self::URL, $input)->assertOk()->assertJsonPath('data.already_bound', true);
        $this->assertSame('suspended', $license->fresh()->status->value);
        $this->assertDatabaseCount('nb_wallet_entries', 1);
    }

    public function test_customer_and_unprivileged_staff_cannot_bind(): void
    {
        $input = $this->input($this->customer()->email);
        $this->postJson(self::URL, $input)->assertUnauthorized();
        foreach ([Role::Customer, Role::Support, Role::Editor] as $role) {
            $this->actingAs($this->userWithRole($role))->postJson(self::URL, $input)->assertForbidden();
        }
        $this->assertDatabaseCount('software_licenses', 0);
    }

    public function test_validation_requires_evidence_and_verified_customer(): void
    {
        $user = $this->customer();
        $input = $this->input($user->email);
        $this->actingAs($this->userWithRole(Role::Admin));
        foreach ([['ownership_verified' => false], ['reason' => ''], ['reference' => ''], ['balance' => 50], ['license_code' => '../bad'], ['email' => 'missing@example.test']] as $bad) {
            $this->postJson(self::URL, [...$input, ...$bad])->assertUnprocessable();
        }
        $user->forceFill(['email_verified_at' => null])->save();
        $this->postJson(self::URL, $input)->assertUnprocessable();
        $this->assertDatabaseCount('software_licenses', 0);
    }

    public function test_order_backed_unpaid_license_is_not_whitelisted_by_binding(): void
    {
        $user = $this->customer();
        $input = $this->input($user->email);
        $order = Order::factory()->for($user)->create(['status' => 'pending_payment']);
        $license = SoftwareLicense::create(['license_code' => $input['license_code'], 'user_id' => $user->id, 'order_id' => $order->id, 'product_name' => 'NB Tools', 'status' => 'issued', 'device_limit' => 1, 'issued_at' => now()]);
        $this->actingAs($this->userWithRole(Role::Admin))->postJson(self::URL, $input)->assertOk()->assertJsonPath('data.already_bound', true);
        $this->assertFalse(app(OnlineLicensingService::class)->hasEntitlement($license));
        $this->assertDatabaseCount('nb_legacy_license_imports', 0);
        $this->assertDatabaseCount('nb_online_wallets', 0);
    }

    public function test_failed_audit_rolls_back_entire_import(): void
    {
        $input = $this->input($this->customer()->email);
        $this->actingAs($this->userWithRole(Role::Admin));
        AuditLog::creating(fn () => throw new \RuntimeException('Test audit failure'));
        try {
            $this->postJson(self::URL, $input)->assertStatus(500);
            $this->assertDatabaseCount('software_licenses', 0);
            $this->assertDatabaseCount('nb_legacy_license_imports', 0);
            $this->assertDatabaseCount('nb_wallet_entries', 0);
        } finally {
            AuditLog::flushEventListeners();
        }
    }

    public function test_csrf_is_required(): void
    {
        $input = $this->input($this->customer()->email);
        $this->actingAs($this->userWithRole(Role::Admin));
        $middleware = config('sanctum.middleware.validate_csrf_token');
        $this->app->bind($middleware, fn ($app) => new class($app, $app['encrypter']) extends VerifyCsrfToken
        {
            protected function runningUnitTests(): bool
            {
                return false;
            }
        });
        $this->postJson(self::URL, $input)->assertStatus(419);
        $this->assertDatabaseCount('software_licenses', 0);
    }
}
