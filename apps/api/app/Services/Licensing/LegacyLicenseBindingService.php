<?php

namespace App\Services\Licensing;

use App\Models\SoftwareLicense;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LegacyLicenseBindingService
{
    public function bind(User $admin, array $input): array
    {
        abort_unless($admin->isStaff() && $admin->isActive() && $admin->hasVerifiedEmail() && $admin->hasPermission('wallets.manage'), 403);
        $rules = [
            'email' => ['required', 'email', 'max:255'],
            'license_code' => ['required', 'string', 'regex:/^NB-[A-Z0-9-]{4,60}$/'],
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
            'reference' => ['required', 'string', 'max:200'],
            'ownership_verified' => ['required', 'accepted'],
        ];
        abort_if(array_diff(array_keys($input), array_keys($rules)) !== [], 422);
        $v = validator($input, $rules)->validate();
        abort_unless(config('online_wallet.enabled') && config('online_licensing.enabled'), 503, 'Online licensing must be enabled before importing a license.');
        try {
            return DB::transaction(function () use ($admin, $v) {
                $user = User::where('email', $v['email'])->lockForUpdate()->first();
                abort_unless($user, 422, 'This email has no website account. Ask the customer to register first.');
                abort_unless($user->isActive() && $user->hasVerifiedEmail() && ! $user->isStaff(), 422, 'Select an active, verified customer account.');
                $license = SoftwareLicense::where('license_code', $v['license_code'])->lockForUpdate()->first();
                if ($license) {
                    abort_unless($license->user_id === $user->id, 409, 'This license belongs to another account. This form cannot transfer ownership.');

                    // Retrying an import never replaces its evidence, status, device or balance.
                    return ['data' => ['license_code' => $license->license_code, 'email' => $user->email, 'already_bound' => true, 'license_id' => $license->id]];
                }
                $license = SoftwareLicense::create([
                    'license_code' => $v['license_code'], 'user_id' => $user->id,
                    'product_name' => 'NB Engineering Tools', 'status' => 'issued',
                    'device_limit' => 1, 'issued_at' => now(),
                ]);
                DB::table('nb_legacy_license_imports')->insert([
                    'software_license_id' => $license->id, 'user_id' => $user->id,
                    'created_by' => $admin->id, 'reason' => $v['reason'],
                    'reference' => $v['reference'], 'created_at' => now(),
                ]);
                DB::table('nb_online_wallets')->insert(['software_license_id' => $license->id, 'balance' => 0, 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
                $transaction = (string) Str::uuid();
                DB::table('nb_wallet_entries')->insert([
                    'software_license_id' => $license->id, 'user_id' => $user->id,
                    'transaction_id' => $transaction, 'reference' => 'legacy-import:'.$license->id,
                    'delta' => 0, 'balance' => 0, 'source' => 'legacy_import', 'action_type' => 'legacy_bound',
                    'created_by' => $admin->id, 'reason' => $v['reason'], 'reference_note' => $v['reference'],
                    'wallet_version' => 1, 'created_at' => now(),
                ]);
                Audit::record('license.legacy_bound', $license, [
                    'user_id' => $user->id, 'license_code' => $license->license_code,
                    'reference' => $v['reference'], 'reason' => $v['reason'], 'transaction_id' => $transaction,
                    'ownership_verified' => true, 'opening_balance' => 0,
                ], $admin->id);

                return ['data' => ['license_code' => $license->license_code, 'email' => $user->email, 'already_bound' => false, 'license_id' => $license->id]];
            }, 5);
        } catch (UniqueConstraintViolationException $e) {
            abort(409, 'This license was bound by another request. Refresh and verify its owner.');
        }
    }
}
