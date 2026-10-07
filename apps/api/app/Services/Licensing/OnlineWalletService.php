<?php

namespace App\Services\Licensing;

use App\Models\Order;
use App\Models\SoftwareLicense;
use App\Services\Payments\ManualWalletCredit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OnlineWalletService
{
    public function managed(int $licenseId): bool
    {
        return Schema::hasTable('nb_online_wallets') && DB::table('nb_online_wallets')->where('software_license_id', $licenseId)->exists();
    }

    public function provisionNew(SoftwareLicense $license): void
    {
        $cutover = config('online_wallet.cutover_at');
        if (! config('online_wallet.enabled') || ! $cutover || $license->created_at->lessThan(Carbon::parse($cutover)) || $this->managed($license->id)) {
            return;
        }
        // Only never-issued licenses after an explicit cutover receive a fresh grant.
        abort_if(DB::table('nb_token_issues')->where('software_license_id', $license->id)->exists() || $license->activationRequests()->whereIn('status', ['approved', 'completed'])->exists(), 409, 'Existing offline license requires manual reconciliation.');
        $offer = config('online_wallet.opening_offer', 50);
        abort_unless(is_int($offer) && $offer >= 0 && $offer <= 1000000, 503, 'Invalid opening offer configuration.');
        abort_unless(DB::transactionLevel() > 0, 409, 'Wallet provisioning requires the locked pairing transaction.');
        DB::table('nb_online_wallets')->insert(['software_license_id' => $license->id, 'balance' => 0, 'created_at' => now(), 'updated_at' => now()]);
        $this->entry($license->id, 'opening:'.$license->id, $offer, $offer, null, 0, null);
        DB::table('nb_online_wallets')->where('software_license_id', $license->id)->update(['balance' => $offer, 'version' => 1]);
    }

    public function license(string $secret): SoftwareLicense
    {
        abort_unless(config('online_licensing.enabled') && config('online_wallet.enabled'), 503, 'Online wallet is not enabled.');
        abort_unless(strlen($secret) === 64, 401);
        $device = DB::table('nb_devices')->where('secret_hash', hash('sha256', $secret))->whereNotNull('confirmed_at')->first();
        abort_unless($device, 401);
        abort_if($device->revoked_at ?? null, 403, 'Device has been revoked.');
        $license = SoftwareLicense::findOrFail($device->software_license_id);
        app(OnlineLicensingService::class)->usable($license);
        abort_unless($license->user->isActive() && $license->user->hasVerifiedEmail(), 403);
        abort_unless($this->managed($license->id), 409, 'This license has not been moved to the online wallet.');
        abort_unless(DB::table('machine_bindings')->where('software_license_id', $license->id)->where('machine_id_fingerprint', $device->machine_hash)->whereNull('released_at')->exists(), 403);
        // A new confirmed connection supersedes earlier secrets for the same machine.
        abort_if(DB::table('nb_devices')->where('software_license_id', $license->id)->where('machine_hash', $device->machine_hash)->whereNotNull('confirmed_at')->where('id', '>', $device->id)->exists(), 401);
        $orders = DB::table('nb_wallet_entries')->where('software_license_id', $license->id)->whereNotNull('order_id')->distinct()->pluck('order_id');
        foreach (Order::whereIn('id', $orders)->get() as $order) {
            abort_unless(in_array($order->status->value, ['paid', 'fulfilled'], true), 403, 'A credited payment requires review.');
        }

        return $license;
    }

    public function balance(SoftwareLicense $license): int
    {
        return (int) DB::table('nb_online_wallets')->where('software_license_id', $license->id)->value('balance');
    }

    public function credit(Order $order, SoftwareLicense $license): void
    {
        DB::transaction(function () use ($order, $license) {
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            $manual = $order->payments()->where('gateway', 'manual')->where('status', 'validated')->lockForUpdate()->first();
            if ($manual) {
                $receipt = app(ManualWalletCredit::class)->receipt($manual);
                abort_unless($receipt['eligible'] && $receipt['license_id'] === $license->id, 409, 'Manual wallet credit must commit with payment approval; reconciliation required.');
                DB::table('refill_orders')->where('order_id', $order->id)->where('status', 'requested')->update(['status' => 'approved', 'software_license_id' => $license->id]);

                return;
            }
            abort_unless($order->user_id === $license->user_id && in_array($order->status->value, ['paid', 'fulfilled'], true), 403);
            app(OnlineLicensingService::class)->usable($license);
            $wallet = DB::table('nb_online_wallets')->where('software_license_id', $license->id)->lockForUpdate()->first();
            abort_unless($wallet, 409);
            abort_unless($order->created_at->greaterThanOrEqualTo(Carbon::parse($wallet->created_at)), 409, 'Older purchases must be reconciled in the opening balance.');
            // Never convert an already-issued offline refill into a second credit.
            abort_if(DB::table('nb_token_issues')->where('order_id', $order->id)->exists() || DB::table('refill_orders')->where('order_id', $order->id)->where('status', 'issued')->exists(), 409, 'Refill already issued through the offline system.');
            foreach ($order->items as $item) {
                if ($item->product_type !== 'credit_refill') {
                    continue;
                }
                $ref = 'purchase:'.$item->id;
                $existing = DB::table('nb_wallet_entries')->where('reference', $ref)->first();
                if ($existing) {
                    abort_unless($existing->software_license_id === $license->id, 409);

                    continue;
                }
                $amount = (int) ($item->fulfillment_meta['credit_amount'] ?? 0) * $item->quantity;
                abort_unless($amount > 0 && $amount <= 1000000, 422);
                abort_if($wallet->balance + $amount > 2147483647, 422, 'Wallet limit exceeded.');
                $wallet->balance += $amount;
                $this->entry($license->id, $ref, $amount, $wallet->balance, null, 0, $order->id);
            }
            DB::table('nb_online_wallets')->where('software_license_id', $license->id)->update(['balance' => $wallet->balance, 'updated_at' => now()]);
            DB::table('refill_orders')->where('order_id', $order->id)->where('status', 'requested')->update(['status' => 'approved', 'software_license_id' => $license->id]);
        });
    }

    public function operation(SoftwareLicense $license, string $command, int $units, ?string $operation): array
    {
        $policy = config('online_wallet.commands.'.$command);
        abort_unless(is_array($policy), 422, 'Unsupported command.');

        return DB::transaction(function () use ($license, $command, $units, $operation, $policy) {
            $wallet = DB::table('nb_online_wallets')->where('software_license_id', $license->id)->lockForUpdate()->first();
            abort_unless($wallet, 409);
            abort_if(Schema::hasTable('nb_wallet_leases') && DB::table('nb_wallet_leases')->where('license_id', $license->id)->exists(), 409, 'Use the offline wallet sync API for this license.');
            abort_if(isset($wallet->status) && $wallet->status !== 'active', 403, 'Wallet is not active.');
            $ref = 'usage:'.$license->id.':'.$operation;
            $existing = $operation ? DB::table('nb_wallet_entries')->where('reference', $ref)->first() : null;
            if ($existing) {
                abort_unless($existing->command === $command && $existing->units === $units, 409, 'Operation identifier was already used for different input.');

                return ['balance' => (int) $wallet->balance, 'charged' => -(int) $existing->delta, 'replayed' => true];
            }
            $cost = (int) $policy['cost'] * ($policy['daily'] ? 1 : $units);
            if ($policy['daily']) {
                $start = now()->setTimezone(config('online_wallet.timezone'))->startOfDay()->utc();
                if (DB::table('nb_wallet_entries')->where('software_license_id', $license->id)->where('command', $command)->where('delta', '<', 0)->where('created_at', '>=', $start)->exists()) {
                    $cost = 0;
                }
            }
            abort_unless($wallet->balance >= $cost, 409, 'Insufficient tokens.');
            if ($operation) {
                $wallet->balance -= $cost;
                $this->entry($license->id, $ref, -$cost, $wallet->balance, $command, $units, null);
                DB::table('nb_online_wallets')->where('software_license_id', $license->id)->update(['balance' => $wallet->balance, 'updated_at' => now(), ...(isset($wallet->version) ? ['version' => $wallet->version + 1] : [])]);
            }

            return ['balance' => (int) $wallet->balance, 'required' => $cost, 'charged' => $operation ? $cost : 0, 'replayed' => false];
        });
    }

    private function entry(int $license, string $ref, int $delta, int $balance, ?string $command, int $units, ?int $order): void
    {
        $opening = str_starts_with($ref, 'opening:');
        DB::table('nb_wallet_entries')->insert(['software_license_id' => $license, 'reference' => $ref, 'command' => $command, 'units' => $units, 'delta' => $delta, 'balance' => $balance, 'order_id' => $order, 'created_at' => now(),
            'transaction_id' => (string) \Illuminate\Support\Str::uuid(),
            'user_id' => SoftwareLicense::whereKey($license)->value('user_id'),
            'source' => $opening ? 'opening_offer' : ($order ? 'purchase' : 'online_usage'),
            'action_type' => $opening ? 'opening_offer' : ($order ? 'payment_credit' : 'command_usage'),
            'reason' => $opening ? 'Configured first activation offer' : null,
            'wallet_version' => (int) DB::table('nb_online_wallets')->where('software_license_id', $license)->value('version') + 1,
        ]);
    }
}
