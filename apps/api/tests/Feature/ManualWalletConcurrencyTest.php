<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Order;
use App\Models\Payment;
use App\Models\SoftwareLicense;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/** Separate-process test: run only on the disposable PHPUnit database. */
#[Group('wallet-concurrency')]
class ManualWalletConcurrencyTest extends TestCase
{
    private function scenario(bool $wallet = true): array
    {
        Bus::fake();
        $user = $this->customer();
        $purchase = Order::factory()->for($user)->paid()->create();
        $item = $purchase->items()->create(['product_type' => 'software_license', 'product_name' => 'Tools', 'variant_name' => 'Single', 'sku' => 'NBET-V6-SINGLE', 'quantity' => 1, 'unit_price_minor' => 100, 'line_total_minor' => 100]);
        $license = SoftwareLicense::create(['license_code' => 'NB-'.Str::uuid(), 'user_id' => $user->id, 'order_id' => $purchase->id, 'order_item_id' => $item->id, 'product_name' => 'Tools', 'status' => 'issued', 'device_limit' => 1, 'issued_at' => now()]);
        if ($wallet) {
            DB::table('nb_online_wallets')->insert(['software_license_id' => $license->id, 'balance' => 100, 'reserved_balance' => 20, 'created_at' => now()->subDay(), 'updated_at' => now()]);
        }
        $order = Order::factory()->for($user)->create();
        $order->items()->create(['product_type' => 'credit_refill', 'product_name' => 'Tokens', 'variant_name' => 'Refill', 'sku' => 'TOKENS', 'quantity' => 2, 'unit_price_minor' => $order->total_minor, 'line_total_minor' => $order->total_minor, 'fulfillment_meta' => ['credit_amount' => 500]]);
        $payment = Payment::create(['order_id' => $order->id, 'gateway' => 'manual', 'reference' => 'PAY-'.Str::uuid(), 'status' => 'pending', 'currency' => $order->currency, 'amount_minor' => $order->total_minor]);
        $submission = DB::table('manual_payment_submissions')->insertGetId(['order_id' => $order->id, 'payment_id' => $payment->id, 'method' => 'bkash', 'transaction_id' => 'TX-'.Str::uuid(), 'sender' => 'TEST', 'recipient' => 'TEST', 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        $admin = $this->userWithRole(Role::Admin);
        $this->actingAs($admin);

        return [$order, $payment, $submission, $license, $admin];
    }

    public function test_two_simultaneous_approvals_credit_exactly_once(): void
    {
        $this->assertTrue(app()->environment('testing'));
        $database = DB::connection()->getDatabaseName();
        $isolatedLocal = (string) config('database.connections.mysql.host') === '127.0.0.1'
            && (int) config('database.connections.mysql.port') === 33318
            && preg_match('/^nb_wallet_eligibility_test_[0-9]+$/', $database) === 1;
        $this->assertTrue($database === 'nuruzzaman_test' || $isolatedLocal, 'Disposable PHPUnit database required; never the working E2E database.');
        $this->assertSame(0, DB::transactionLevel());
        $this->artisan('migrate:fresh', ['--force' => true])->assertSuccessful();
        $workers = [];
        $directory = sys_get_temp_dir().'/nb-payment-race-'.Str::uuid();
        mkdir($directory);
        try {
            [$order, $payment, $id, $license, $admin] = $this->scenario();
            $root = var_export(base_path(), true);
            $script = "<?php\nrequire $root.'/vendor/autoload.php';\n\$app = require $root.'/bootstrap/app.php';\n";
            $script .= <<<'PHP'
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
Illuminate\Support\Facades\Bus::fake();
$admin = App\Models\User::findOrFail((int) $argv[2]);
file_put_contents($argv[4], 'ready');
$result = app(App\Services\Payments\ManualPaymentReview::class)->review($admin, (int) $argv[1], ['decision'=>'approved', 'note'=>'Concurrent verification', 'confirmed_amount_minor'=>(int)$argv[3]]);
echo json_encode($result, JSON_THROW_ON_ERROR);
PHP;
            file_put_contents($directory.'/worker.php', $script);
            DB::beginTransaction();
            Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            $connection = config('database.connections.mysql');
            $environment = ['APP_ENV' => 'testing', 'APP_KEY' => config('app.key'), 'APP_BASE_PATH' => base_path(), 'DB_CONNECTION' => 'mysql', 'DB_HOST' => $connection['host'], 'DB_PORT' => (string) $connection['port'], 'DB_DATABASE' => $database, 'DB_USERNAME' => $connection['username'], 'DB_PASSWORD' => $connection['password'], 'DB_URL' => '', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'NIGHTWATCH_ENABLED' => 'false', 'TELESCOPE_ENABLED' => 'false'];
            foreach ([1, 2] as $n) {
                $worker = new Process([PHP_BINARY, $directory.'/worker.php', (string) $id, (string) $admin->id, (string) $order->total_minor, $directory.'/ready'.$n], base_path(), $environment);
                $worker->setTimeout(40);
                $worker->start();
                $workers[] = $worker;
            }
            $deadline = microtime(true) + 20;
            while ((! is_file($directory.'/ready1') || ! is_file($directory.'/ready2')) && microtime(true) < $deadline) {
                usleep(50000);
            }
            $this->assertFileExists($directory.'/ready1');
            $this->assertFileExists($directory.'/ready2');
            $this->assertTrue($workers[0]->isRunning());
            $this->assertTrue($workers[1]->isRunning());
            DB::commit();
            $results = [];
            foreach ($workers as $worker) {
                $worker->wait();
                $this->assertSame(0, $worker->getExitCode(), $worker->getErrorOutput().$worker->getOutput());
                $results[] = json_decode($worker->getOutput(), true, flags: JSON_THROW_ON_ERROR)['wallet_credit'];
            }
            $this->assertSame($results[0]['transaction_id'], $results[1]['transaction_id']);
            $this->assertNotSame($results[0]['already_credited'], $results[1]['already_credited']);
            $this->assertDatabaseCount('nb_wallet_entries', 1);
            $this->assertDatabaseHas('nb_online_wallets', ['software_license_id' => $license->id, 'balance' => 1100, 'reserved_balance' => 20, 'version' => 1]);
            $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'validated']);
        } finally {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            foreach ($workers as $worker) {
                if ($worker->isRunning()) {
                    $worker->stop();
                }
            }
            foreach (glob($directory.'/*') as $file) {
                unlink($file);
            }
            rmdir($directory);
            $this->artisan('migrate:fresh', ['--force' => true]);
        }
    }
}
