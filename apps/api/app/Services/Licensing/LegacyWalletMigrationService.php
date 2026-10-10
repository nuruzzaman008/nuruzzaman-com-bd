<?php

namespace App\Services\Licensing;

use App\Models\SoftwareLicense;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

class LegacyWalletMigrationService
{
    /** Trusted administrative cutover operation, deliberately not exposed as a customer API. */
    public function migrate(User $admin, int $licenseId, array $evidence): array
    {
        abort_unless($admin->isStaff() && $admin->isActive() && $admin->hasVerifiedEmail() && $admin->hasPermission('wallets.manage'), 403);
        $evidence = validator($evidence, [
            'transaction_id' => ['required', 'uuid'],
            'expected_version' => ['required', 'integer:strict', 'min:0'],
            'email' => ['required', 'email'],
            'license_code' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'integer:strict', 'between:1,1000000'],
            'wallet_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'wallet_sequence' => ['required', 'integer:strict', 'min:0'],
            'retired_runtime_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'cutover_reference' => ['required', 'string', 'min:3', 'max:150'],
            'legacy_runtime_retired' => ['required', 'accepted'],
            'reason' => ['required', 'string', 'min:3', 'max:1000'],
        ])->validate();
        ksort($evidence);
        $hash = hash('sha256', json_encode(['admin' => $admin->id, 'license' => $licenseId, 'evidence' => $evidence], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($admin, $licenseId, $evidence, $hash) {
            $license = SoftwareLicense::whereKey($licenseId)->lockForUpdate()->firstOrFail();
            abort_unless($license->license_code === $evidence['license_code'] && strcasecmp($license->user->email, $evidence['email']) === 0, 409, 'License ownership does not match the reviewed wallet.');
            $reference = 'legacy-migration:'.$licenseId;
            $prior = DB::table('nb_wallet_entries')->where('reference', $reference)->first();
            if ($prior) {
                abort_unless($prior->request_hash && hash_equals($prior->request_hash, $hash), 409, 'This license already has a different legacy migration.');

                return json_decode($prior->action_response, true, flags: JSON_THROW_ON_ERROR);
            }
            abort_unless(in_array($license->status->value, ['issued', 'active'], true) && (! $license->expires_at || $license->expires_at->isFuture()) && app(OnlineLicensingService::class)->hasEntitlement($license), 409, 'An eligible active license is required.');
            abort_if(DB::table('nb_wallet_entries')->where('transaction_id', $evidence['transaction_id'])->exists(), 409, 'Transaction ID already belongs to another operation.');
            $response = app(AdminWalletService::class)->act($admin, $licenseId, [
                'transaction_id' => $evidence['transaction_id'], 'expected_version' => $evidence['expected_version'],
                'action' => 'add', 'amount' => $evidence['amount'], 'reason' => $evidence['reason'],
                'reference_note' => $evidence['cutover_reference'].'; wallet sha256='.$evidence['wallet_sha256'].'; sequence='.$evidence['wallet_sequence'],
            ]);
            $response['data']['action_type'] = 'legacy_migration';
            DB::table('nb_wallet_entries')->where('transaction_id', $evidence['transaction_id'])->update([
                'reference' => $reference, 'source' => 'legacy_migration', 'action_type' => 'legacy_migration',
                'request_hash' => $hash, 'action_response' => json_encode($response, JSON_THROW_ON_ERROR),
            ]);
            Audit::record('wallet.legacy_migrated', $license, $evidence, $admin->id);

            return $response;
        }, 5);
    }
}
