<?php

namespace App\Services\Licensing;

use App\Models\SoftwareLicense;
use App\Support\Audit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class SqlOfflineWalletLedger implements OfflineWalletLedger
{
    private function device(int $id): object
    {
        abort_unless(config('offline_wallet.enabled'), 503);
        $device = DB::table('nb_devices')->where('id', $id)->first();
        abort_unless($device && $device->confirmed_at && $device->software_license_id, 403);
        $license = SoftwareLicense::whereKey($device->software_license_id)->lockForUpdate()->first();
        abort_unless($license, 403);
        app(OnlineLicensingService::class)->usable($license);
        abort_unless($license->user && $license->user->isActive() && $license->user->hasVerifiedEmail(), 403);
        $device = DB::table('nb_devices')->where('id', $id)->lockForUpdate()->first();
        abort_unless($device && $device->confirmed_at && $device->software_license_id === $license->id, 403);
        abort_if($device->revoked_at ?? null, 403, 'Device has been revoked.');
        abort_unless(DB::table('machine_bindings')->where('software_license_id', $license->id)->where('machine_id_fingerprint', $device->machine_hash)->whereNull('released_at')->lockForUpdate()->first(), 403);
        abort_if(DB::table('nb_devices')->where('software_license_id', $license->id)->where('machine_hash', $device->machine_hash)->whereNotNull('confirmed_at')->where('id', '>', $id)->exists(), 401);

        if (property_exists($device, 'last_seen_at')) {
            DB::table('nb_devices')->where('id', $id)->update(['last_seen_at' => now()]);
        }

        return $device;
    }

    private function wallet(int $id, bool $lock = false): object
    {
        $query = DB::table('nb_online_wallets')->where('software_license_id', $id);
        $wallet = ($lock ? $query->lockForUpdate() : $query)->first();
        abort_unless($wallet, 409, 'Wallet must be provisioned before API use.');
        abort_unless($wallet->status === 'active', 403, 'Wallet is not active.');

        return $wallet;
    }

    private function view(object $wallet): array
    {
        return ['license_id' => (int) $wallet->software_license_id, 'available_balance' => (int) ($wallet->balance - $wallet->reserved_balance), 'reserved_balance' => (int) $wallet->reserved_balance, 'status' => $wallet->status, 'version' => (int) $wallet->version];
    }

    private function hash(array $value): string
    {
        $canonical = function (mixed $value) use (&$canonical): mixed {
            if (! is_array($value)) {
                return $value;
            }
            if (! array_is_list($value)) {
                ksort($value);
            }

            return array_map($canonical, $value);
        };

        return hash('sha256', json_encode($canonical($value), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
    }

    public function balance(int $authorizedLicenseId): array
    {
        return $this->view($this->wallet($authorizedLicenseId));
    }

    public function adjust(int $authorizedLicenseId, string $transactionId, string $type, int $amount, string $source, int $createdBy, string $reason, int $expectedVersion, string $referenceNote): array
    {
        abort_unless(auth()->id() === $createdBy && in_array($type, ['credit', 'debit'], true) && $source === 'admin_adjustment', 403);

        return app(AdminWalletService::class)->act(auth()->user(), $authorizedLicenseId, [
            'transaction_id' => $transactionId, 'action' => $type === 'credit' ? 'add' : 'deduct', 'amount' => $amount,
            'reason' => $reason, 'reference_note' => $referenceNote, 'expected_version' => $expectedVersion,
        ]);
    }

    public function reserve(int $authorizedLicenseId, int $confirmedDeviceId, string $requestId, int $allowance, int $expectedVersion, OfflineWalletPolicy $policy): array
    {
        $hash = $this->hash(['request_id' => $requestId, 'expected_version' => $expectedVersion, 'requested_allowance' => $allowance]);

        return DB::transaction(function () use ($authorizedLicenseId, $confirmedDeviceId, $requestId, $allowance, $expectedVersion, $policy, $hash) {
            $device = $this->device($confirmedDeviceId);
            abort_unless($device->software_license_id === $authorizedLicenseId, 403);
            $wallet = $this->wallet($authorizedLicenseId, true);
            $existing = DB::table('nb_wallet_leases')->where('device_id', $confirmedDeviceId)->where('request_id', $requestId)->first();
            if ($existing) {
                abort_unless(hash_equals($existing->request_hash, $hash), 409, 'Request ID reused with different payload.');

                return json_decode($existing->policy_snapshot, true, flags: JSON_THROW_ON_ERROR)['connect_response'];
            }
            abort_if(DB::table('nb_wallet_syncs')->where('device_id', $confirmedDeviceId)->where('request_id', $requestId)->exists(), 409, 'Request ID already belongs to sync.');
            abort_unless($wallet->version === $expectedVersion, 409, 'Wallet version changed; fetch balance.');
            abort_unless($allowance > 0 && $allowance <= $policy->maxAllowance, 422);
            abort_unless($wallet->balance - $wallet->reserved_balance >= $allowance, 409, 'Insufficient available tokens.');
            abort_if(DB::table('nb_wallet_leases')->where('device_id', $confirmedDeviceId)->whereIn('status', ['active', 'review_required'])->exists(), 409, 'Existing allowance must be settled or reviewed first.');
            $id = (string) Str::uuid();
            $issued = now()->utc();
            $due = $issued->copy()->addSeconds($policy->syncIntervalSeconds);
            $expires = $issued->copy()->addSeconds($policy->leaseSeconds);
            $pricing = config('online_wallet.commands');
            abort_unless(is_array($pricing) && $pricing !== [], 503, 'Pricing policy unavailable.');
            $publicPolicy = ['version' => $policy->version, 'max_allowance' => $policy->maxAllowance, 'lease_seconds' => $policy->leaseSeconds, 'sync_interval_seconds' => $policy->syncIntervalSeconds, 'first_online_activation_required' => true];
            $snapshot = ['policy' => $publicPolicy, 'commands' => $pricing, 'billing_day' => $issued->copy()->setTimezone(config('online_wallet.timezone'))->toDateString()];
            $keyId = (string) config('offline_wallet.signing_key_id');
            $grant = app(WalletLeaseSigner::class)->sign(['iss' => 'nuruzzaman.com.bd', 'aud' => 'nb-engineering-tools', 'iat' => $issued->timestamp, 'exp' => $expires->timestamp, 'jti' => $id, 'license_id' => $authorizedLicenseId, 'device_id' => $confirmedDeviceId, 'allowance' => $allowance, 'sync_due_at' => $due->timestamp, 'policy' => $snapshot], $keyId);
            $wallet->reserved_balance += $allowance;
            $wallet->version++;
            $response = ['data' => ['wallet' => $this->view($wallet), 'lease' => ['id' => $id, 'device_id' => $confirmedDeviceId, 'allowance' => $allowance, 'policy' => $publicPolicy, 'issued_at' => $issued->format('Y-m-d\TH:i:s\Z'), 'sync_due_at' => $due->format('Y-m-d\TH:i:s\Z'), 'expires_at' => $expires->format('Y-m-d\TH:i:s\Z'), 'grant' => $grant]]];
            $snapshot['connect_response'] = $response;
            DB::table('nb_wallet_leases')->insert(['id' => $id, 'license_id' => $authorizedLicenseId, 'device_id' => $confirmedDeviceId, 'request_id' => $requestId, 'request_hash' => $hash, 'allowance' => $allowance, 'policy_version' => $policy->version, 'policy_snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'signing_key_id' => $keyId, 'issued_at' => $issued, 'sync_due_at' => $due, 'expires_at' => $expires]);
            DB::table('nb_online_wallets')->where('software_license_id', $authorizedLicenseId)->update(['reserved_balance' => $wallet->reserved_balance, 'version' => $wallet->version, 'updated_at' => now()]);

            return $response;
        }, 5);
    }

    public function sync(int $confirmedDeviceId, string $requestId, string $leaseId, int $expectedVersion, array $usage): array
    {
        $hash = $this->hash(['request_id' => $requestId, 'lease_id' => $leaseId, 'expected_version' => $expectedVersion, 'transactions' => $usage]);

        $result = DB::transaction(function () use ($confirmedDeviceId, $requestId, $leaseId, $expectedVersion, $usage, $hash) {
            $device = $this->device($confirmedDeviceId);
            $wallet = $this->wallet($device->software_license_id, true);
            $existing = DB::table('nb_wallet_syncs')->where('device_id', $confirmedDeviceId)->where('request_id', $requestId)->first();
            if ($existing) {
                abort_unless(hash_equals($existing->request_hash, $hash), 409, 'Request ID reused with different payload.');

                return json_decode($existing->response, true, flags: JSON_THROW_ON_ERROR);
            }
            abort_if(DB::table('nb_wallet_leases')->where('device_id', $confirmedDeviceId)->where('request_id', $requestId)->exists(), 409, 'Request ID already belongs to connect.');
            $lease = DB::table('nb_wallet_leases')->where('id', $leaseId)->lockForUpdate()->first();
            abort_unless($lease && $lease->device_id === $confirmedDeviceId && $lease->license_id === $device->software_license_id, 403, 'Lease does not belong to this device.');
            try {
                return DB::transaction(function () use ($wallet, $lease, $device, $confirmedDeviceId, $requestId, $leaseId, $expectedVersion, $usage, $hash) {
                    $prior = DB::table('nb_wallet_entries')->whereIn('transaction_id', array_column($usage, 'transaction_id'))->get()->keyBy('transaction_id');
                    if ($prior->isNotEmpty()) {
                        abort_unless($prior->count() === count($usage), 409, 'Do not mix settled transactions with new usage. Retry the original batch.');
                        foreach ($usage as $entry) {
                            $settled = $prior->get($entry['transaction_id']);
                            abort_unless($settled && $settled->device_id === $confirmedDeviceId && $settled->lease_id === $leaseId && $settled->software_license_id === $device->software_license_id && $settled->request_hash && hash_equals($settled->request_hash, $this->hash($entry)), 409, 'Transaction ID reused with different payload or identity.');
                        }
                        $id = (string) Str::uuid();
                        $response = ['data' => ['sync_id' => $id, 'request_id' => $requestId, 'status' => 'accepted', 'replayed' => true, 'accepted_transaction_ids' => array_column($usage, 'transaction_id'), 'last_sequence' => $lease->last_sequence, 'wallet' => $this->view($wallet), 'lease_remaining' => $lease->allowance - $lease->consumed - $lease->released, 'server_time' => now()->utc()->format('Y-m-d\TH:i:s\Z')]];
                        DB::table('nb_wallet_syncs')->insert(['id' => $id, 'license_id' => $device->software_license_id, 'device_id' => $confirmedDeviceId, 'lease_id' => $leaseId, 'request_id' => $requestId, 'request_hash' => $hash, 'expected_version' => $expectedVersion, 'result_version' => $wallet->version, 'first_sequence' => $usage[0]['sequence'], 'last_sequence' => $lease->last_sequence, 'accepted_count' => count($usage), 'status' => 'accepted', 'response' => json_encode($response, JSON_THROW_ON_ERROR), 'created_at' => now(), 'completed_at' => now()]);
                        Audit::record('wallet.sync_replayed', null, ['license_id' => $device->software_license_id, 'device_id' => $confirmedDeviceId, 'request_id' => $requestId, 'transaction_ids' => array_column($usage, 'transaction_id')]);

                        return $response;
                    }
                    abort_unless($wallet->version === $expectedVersion, 409, 'Wallet version changed; fetch balance.');
                    abort_unless($lease->status === 'active' && Carbon::parse($lease->expires_at)->isFuture(), 409, 'Lease expired or inactive; reconciliation required.');
                    abort_unless(count($usage) >= 1 && count($usage) <= config('offline_wallet.max_batch_size'), 422);
                    $snapshot = json_decode($lease->policy_snapshot, true, flags: JSON_THROW_ON_ERROR);
                    $remaining = $lease->allowance - $lease->consumed - $lease->released;
                    $sequence = (int) $lease->last_sequence;
                    $charged = 0;
                    $ids = [];
                    $nextVersion = $wallet->version + 1;
                    foreach ($usage as $entry) {
                        abort_unless($entry['sequence'] === ++$sequence, 409, 'Expected contiguous device sequence.');
                        abort_if(DB::table('nb_wallet_entries')->where('transaction_id', $entry['transaction_id'])->exists(), 409, 'Transaction already exists in another batch.');
                        $pricing = $snapshot['commands'][$entry['command']] ?? null;
                        abort_unless(is_array($pricing), 422, 'Command is not in the lease pricing policy.');
                        $cost = (int) $pricing['cost'] * ($pricing['daily'] ? 1 : $entry['units']);
                        if ($pricing['daily'] && DB::table('nb_wallet_entries as e')->join('nb_wallet_leases as l', 'l.id', '=', 'e.lease_id')->where('e.software_license_id', $device->software_license_id)->where('e.command', $entry['command'])->where('e.delta', '<', 0)->where('l.policy_snapshot->billing_day', $snapshot['billing_day'])->exists()) {
                            $cost = 0;
                        }
                        abort_unless($cost >= 0 && $charged + $cost <= $remaining, 409, 'Usage exceeds reserved allowance.');
                        $charged += $cost;
                        abort_unless($charged <= $wallet->reserved_balance && $charged <= $wallet->balance, 409, 'Reserved balance requires reconciliation.');
                        DB::table('nb_wallet_entries')->insert(['software_license_id' => $device->software_license_id, 'reference' => 'offline:'.$entry['transaction_id'], 'transaction_id' => $entry['transaction_id'], 'command' => $entry['command'], 'units' => $entry['units'], 'delta' => -$cost, 'balance' => $wallet->balance - $charged, 'source' => 'offline_usage', 'device_id' => $confirmedDeviceId, 'lease_id' => $leaseId, 'device_sequence' => $entry['sequence'], 'request_hash' => $this->hash($entry), 'wallet_version' => $nextVersion, 'created_at' => now()]);
                        $ids[] = $entry['transaction_id'];
                    }
                    $wallet->balance -= $charged;
                    $wallet->reserved_balance -= $charged;
                    $wallet->version = $nextVersion;
                    DB::table('nb_online_wallets')->where('software_license_id', $device->software_license_id)->update(['balance' => $wallet->balance, 'reserved_balance' => $wallet->reserved_balance, 'version' => $wallet->version, 'updated_at' => now()]);
                    $remaining -= $charged;
                    DB::table('nb_wallet_leases')->where('id', $leaseId)->update(['consumed' => $lease->consumed + $charged, 'last_sequence' => $sequence, 'status' => $remaining === 0 ? 'settled' : 'active', 'closed_at' => $remaining === 0 ? now() : null]);
                    $id = (string) Str::uuid();
                    $response = ['data' => ['sync_id' => $id, 'request_id' => $requestId, 'status' => 'accepted', 'accepted_transaction_ids' => $ids, 'last_sequence' => $sequence, 'wallet' => $this->view($wallet), 'lease_remaining' => $remaining, 'server_time' => now()->utc()->format('Y-m-d\TH:i:s\Z')]];
                    DB::table('nb_wallet_syncs')->insert(['id' => $id, 'license_id' => $device->software_license_id, 'device_id' => $confirmedDeviceId, 'lease_id' => $leaseId, 'request_id' => $requestId, 'request_hash' => $hash, 'expected_version' => $expectedVersion, 'result_version' => $nextVersion, 'first_sequence' => $usage[0]['sequence'], 'last_sequence' => $sequence, 'accepted_count' => count($ids), 'status' => 'accepted', 'response' => json_encode($response, JSON_THROW_ON_ERROR), 'created_at' => now(), 'completed_at' => now()]);
                    Audit::record('wallet.sync_accepted', null, ['license_id' => $device->software_license_id, 'device_id' => $confirmedDeviceId, 'request_id' => $requestId, 'transaction_ids' => $ids, 'amount' => $charged]);

                    return $response;
                });
            } catch (\Throwable $e) {
                if (! $e instanceof HttpExceptionInterface && ! $e instanceof UniqueConstraintViolationException) {
                    throw $e;
                }
                $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : 409;
                $message = $status === 409 && $e instanceof UniqueConstraintViolationException ? 'Transaction already exists in another batch.' : $e->getMessage();
                $rejection = ['__error' => [$status, $message]];
                DB::table('nb_wallet_syncs')->insert(['id' => (string) Str::uuid(), 'license_id' => $device->software_license_id, 'device_id' => $confirmedDeviceId, 'lease_id' => $leaseId, 'request_id' => $requestId, 'request_hash' => $hash, 'expected_version' => $expectedVersion, 'status' => 'rejected', 'error_code' => (string) $status, 'response' => json_encode($rejection, JSON_THROW_ON_ERROR), 'created_at' => now(), 'completed_at' => now()]);
                Audit::record('wallet.sync_rejected', null, ['license_id' => $device->software_license_id, 'device_id' => $confirmedDeviceId, 'request_id' => $requestId, 'status' => $status, 'reason' => $message]);

                return $rejection;
            }
        }, 5);
        if (isset($result['__error'])) {
            abort($result['__error'][0], $result['__error'][1]);
        }

        return $result;
    }

    /** Online command charges use only unreserved funds; offline leases remain independent claims on this same wallet. */
    public function command(int $deviceId, string $command, int $units, ?string $transactionId): array
    {
        return DB::transaction(function () use ($deviceId, $command, $units, $transactionId) {
            $device = $this->device($deviceId);
            $wallet = $this->wallet($device->software_license_id, true);
            $policy = config('online_wallet.commands.'.$command);
            abort_unless(is_array($policy) && $units >= 1 && $units <= 10000, 422, 'Unsupported command or units.');
            $existing = $transactionId ? DB::table('nb_wallet_entries')->where('transaction_id', $transactionId)->first() : null;
            if ($existing) {
                abort_unless($existing->software_license_id === $device->software_license_id && $existing->device_id === $deviceId && $existing->source === 'online_command' && $existing->command === $command && $existing->units === $units, 409, 'Transaction ID reused with different input.');

                return ['wallet' => $this->view($wallet), 'required' => (int) $existing->amount, 'transaction_id' => $transactionId, 'replayed' => true];
            }
            $cost = (int) $policy['cost'] * ($policy['daily'] ? 1 : $units);
            if ($policy['daily']) {
                $start = now()->setTimezone(config('online_wallet.timezone'))->startOfDay()->utc();
                if (DB::table('nb_wallet_entries')->where('software_license_id', $device->software_license_id)->where('command', $command)->where('delta', '<', 0)->where('created_at', '>=', $start)->exists()) {
                    $cost = 0;
                }
            }
            abort_unless($cost >= 0 && $wallet->balance - $wallet->reserved_balance >= $cost, 409, 'Insufficient available tokens. Reserved tokens cannot be spent here.');
            if ($transactionId) {
                $wallet->balance -= $cost;
                $wallet->version++;
                DB::table('nb_wallet_entries')->insert([
                    'software_license_id' => $device->software_license_id, 'transaction_id' => $transactionId,
                    'reference' => 'command:'.$device->software_license_id.':'.$transactionId, 'device_id' => $deviceId,
                    'user_id' => SoftwareLicense::findOrFail($device->software_license_id)->user_id,
                    'command' => $command, 'units' => $units, 'delta' => -$cost, 'balance' => $wallet->balance,
                    'source' => 'online_command', 'action_type' => 'command_usage',
                    'wallet_version' => $wallet->version, 'reason' => 'Engineering command completed', 'created_at' => now(),
                ]);
                DB::table('nb_online_wallets')->where('software_license_id', $device->software_license_id)->update(['balance' => $wallet->balance, 'version' => $wallet->version, 'updated_at' => now()]);
            }

            return ['wallet' => $this->view($wallet), 'required' => $cost, 'transaction_id' => $transactionId, 'replayed' => false];
        }, 5);
    }

    public function history(int $authorizedLicenseId, ?string $cursor, int $limit): array
    {
        $this->wallet($authorizedLicenseId);
        $entries = DB::table('nb_wallet_entries')->where('software_license_id', $authorizedLicenseId)->when($cursor, fn ($q) => $q->where('id', '<', (int) $cursor))->orderByDesc('id')->limit($limit + 1)->get();
        $page = $entries->take($limit);

        return ['data' => $page->map(fn ($e) => ['transaction_id' => $e->transaction_id, 'type' => $e->source === 'offline_usage' ? 'debit' : $e->entry_type, 'amount' => (int) $e->amount, 'source' => $e->source, 'device_id' => $e->device_id, 'created_by' => $e->created_by, 'created_at' => Carbon::parse($e->created_at)->utc()->format('Y-m-d\TH:i:s\Z')])->values()->all(), 'meta' => ['next_cursor' => $entries->count() > $limit ? (string) $page->last()->id : null]];
    }
}
