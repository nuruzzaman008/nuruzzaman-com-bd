<?php

namespace App\Services\Licensing;

use App\Enums\LicenseStatus;
use App\Http\Requests\AdminWalletActionRequest;
use App\Models\SoftwareLicense;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class AdminWalletService
{
    public function act(User $admin, int $licenseId, array $input): array
    {
        abort_unless($admin->isStaff() && $admin->isActive() && $admin->hasVerifiedEmail() && $admin->hasPermission('wallets.manage'), 403);
        $rules = (new AdminWalletActionRequest)->rules();
        abort_if(array_diff(array_keys($input), array_keys($rules)) !== [], 422);
        $input = validator($input, $rules)->validate();
        $identity = ['admin_id' => $admin->id, 'license_id' => $licenseId, ...$input];
        ksort($identity);
        $hash = hash('sha256', json_encode($identity, JSON_THROW_ON_ERROR));

        try {
            return DB::transaction(function () use ($admin, $licenseId, $input, $hash) {
                $license = SoftwareLicense::whereKey($licenseId)->lockForUpdate()->firstOrFail();
                $wallet = DB::table('nb_online_wallets')->where('software_license_id', $licenseId)->lockForUpdate()->first();
                abort_unless($wallet, 404, 'Wallet has not been provisioned.');
                $existing = DB::table('nb_wallet_entries')->where('transaction_id', $input['transaction_id'])->first();
                if ($existing) {
                    abort_unless($existing->request_hash && hash_equals($existing->request_hash, $hash) && $existing->action_response, 409, 'Transaction ID belongs to a different action.');

                    return json_decode($existing->action_response, true, flags: JSON_THROW_ON_ERROR);
                }
                abort_unless((int) $wallet->version === $input['expected_version'], 409, 'Wallet changed. Refresh before submitting a new action.');
                abort_if($wallet->status === 'closed', 409, 'Closed wallets require a separate reconciliation process.');
                $before = $wallet->status;
                $licenseBefore = $license->status->value;
                $delta = 0;
                if ($input['action'] === 'reset_device') {
                    $devices = DB::table('nb_devices')->where('software_license_id', $licenseId)->whereNull('revoked_at')->whereNotNull('confirmed_at')->pluck('id');
                    $bindings = $license->machineBindings()->whereNull('released_at')->get(['id', 'bound_at']);
                    abort_if($devices->isEmpty() && $bindings->isEmpty(), 409, 'There is no active device to reset.');
                    DB::table('nb_devices')->whereIn('id', $devices)->update(['revoked_at' => now(), 'revoked_by' => $admin->id, 'revocation_reason' => $input['reason'], 'updated_at' => now()]);
                    $license->machineBindings()->whereNull('released_at')->update(['released_at' => now()]);
                    // Unacknowledged offline usage must never become spendable again on reset.
                    DB::table('nb_wallet_leases')->whereIn('device_id', $devices)->where('status', 'active')->update(['status' => 'review_required']);
                    $type = 'admin_device_reset';
                    Audit::record('device.reset', $license, ['license_id' => $licenseId, 'device_ids' => $devices->all(), 'bindings' => $bindings->toArray(), 'reason' => $input['reason'], 'transaction_id' => $input['transaction_id'], 'reference' => $input['reference_note']], $admin->id);
                } elseif ($input['action'] === 'license_status') {
                    $next = match ($input['status']) {
                        'active' => LicenseStatus::Active,
                        'suspended' => LicenseStatus::Suspended,
                        'blocked' => LicenseStatus::Revoked,
                    };
                    abort_if($license->status === $next, 409, 'License already has this status.');
                    if ($next === LicenseStatus::Active) {
                        abort_unless($license->order?->status->grantsEntitlements() && (! $license->expires_at || $license->expires_at->isFuture()), 409, 'A paid, unexpired license is required.');
                    }
                    $license->update(['status' => $next, 'revoked_at' => $next === LicenseStatus::Revoked ? now() : null, 'revoked_reason' => $next === LicenseStatus::Revoked ? mb_substr($input['reason'], 0, 255) : null]);
                    $type = 'admin_license_status';
                    Audit::record('license.'.$input['status'], $license, ['license_id' => $licenseId, 'before' => $licenseBefore, 'after' => $next->value, 'reason' => $input['reason'], 'reference' => $input['reference_note'], 'transaction_id' => $input['transaction_id']], $admin->id);
                } elseif ($input['action'] === 'status') {
                    abort_if($before === $input['status'], 409, 'Wallet already has this status.');
                    $wallet->status = $input['status'];
                    $type = 'admin_status_change';
                } else {
                    abort_unless($wallet->status === 'active', 409, 'Activate the wallet before adjusting tokens.');
                    $delta = $input['action'] === 'add' ? $input['amount'] : -$input['amount'];
                    abort_if($delta < 0 && -$delta > $wallet->balance - $wallet->reserved_balance, 409, 'Cannot deduct reserved tokens.');
                    abort_if($wallet->balance + $delta > 2147483647, 422, 'Wallet balance limit exceeded.');
                    $type = $delta > 0 ? 'admin_credit' : 'admin_debit';
                }
                $wallet->balance += $delta;
                $wallet->version++;
                $response = ['data' => ['transaction_id' => $input['transaction_id'], 'action_type' => $type, 'license_id' => $licenseId, 'license_status' => $license->status->value, 'balance' => (int) $wallet->balance, 'available_balance' => (int) ($wallet->balance - $wallet->reserved_balance), 'reserved_balance' => (int) $wallet->reserved_balance, 'status' => $wallet->status, 'version' => (int) $wallet->version]];
                DB::table('nb_wallet_entries')->insert([
                    'software_license_id' => $licenseId, 'reference' => 'admin:'.$input['transaction_id'], 'transaction_id' => $input['transaction_id'],
                    'delta' => $delta, 'balance' => $wallet->balance, 'source' => 'admin_adjustment', 'action_type' => $type,
                    'reason' => $input['reason'], 'reference_note' => $input['reference_note'], 'created_by' => $admin->id, 'user_id' => $license->user_id,
                    'status_before' => $before, 'status_after' => $wallet->status, 'request_hash' => $hash,
                    'wallet_version' => $wallet->version, 'action_response' => json_encode($response, JSON_THROW_ON_ERROR), 'created_at' => now(),
                ]);
                DB::table('nb_online_wallets')->where('software_license_id', $licenseId)->update(['balance' => $wallet->balance, 'status' => $wallet->status, 'version' => $wallet->version, 'updated_at' => now()]);
                Audit::record('wallet.'.$type, $license, ['transaction_id' => $input['transaction_id'], 'delta' => $delta, 'reason' => $input['reason'], 'reference_note' => $input['reference_note'], 'status_before' => $before, 'status_after' => $wallet->status, 'balance_after' => $wallet->balance, 'version' => $wallet->version], $admin->id);

                return $response;
            }, 5);
        } catch (UniqueConstraintViolationException $e) {
            abort(409, 'Transaction ID already exists. Refresh the wallet and check history.');
        }
    }
}
