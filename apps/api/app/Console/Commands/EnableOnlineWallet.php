<?php

namespace App\Console\Commands;

use App\Models\SoftwareLicense;
use App\Services\Licensing\OnlineLicensingService;
use App\Support\Audit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EnableOnlineWallet extends Command
{
    protected $signature = 'nb:enable-online-wallet {license} {opening_balance} {--reason=} {--acknowledge-offline-version}';

    protected $description = 'Create one online wallet with an explicitly reviewed opening balance; never resets an existing wallet';

    public function handle(): int
    {
        $amount = filter_var($this->argument('opening_balance'), FILTER_VALIDATE_INT);
        if (! config('online_wallet.enabled') || ! $this->option('acknowledge-offline-version') || $amount === false || $amount < 0 || $amount > 1000000 || ! trim((string) $this->option('reason'))) {
            $this->error('Enable NB_ONLINE_WALLET, supply a reviewed balance (0..1000000), --reason, and --acknowledge-offline-version. Old offline binaries cannot be revoked remotely.');

            return self::FAILURE;
        }
        DB::transaction(function () use ($amount) {
            $license = SoftwareLicense::where('license_code', $this->argument('license'))->lockForUpdate()->firstOrFail();
            app(OnlineLicensingService::class)->usable($license);
            abort_if(DB::table('nb_online_wallets')->where('software_license_id', $license->id)->exists(), 409, 'Wallet already exists; its balance will not be reset.');
            DB::table('nb_online_wallets')->insert(['software_license_id' => $license->id, 'balance' => $amount, 'created_at' => now(), 'updated_at' => now()]);
            $transaction = (string) Str::uuid();
            DB::table('nb_wallet_entries')->insert(['software_license_id' => $license->id, 'reference' => 'opening:'.$license->id, 'transaction_id' => $transaction, 'user_id' => $license->user_id, 'delta' => $amount, 'balance' => $amount, 'source' => 'legacy_reconciliation', 'action_type' => 'reviewed_opening', 'reason' => mb_substr($this->option('reason'), 0, 2000), 'created_at' => now()]);
            Audit::record('wallet.legacy_reconciled', $license, ['license_id' => $license->id, 'user_id' => $license->user_id, 'amount' => $amount, 'transaction_id' => $transaction, 'reason' => mb_substr($this->option('reason'), 0, 2000), 'actor' => 'console_operator']);
            // The reason is logged without credentials or machine identifiers.
            logger()->notice('Online wallet provisioned', ['license_id' => $license->id, 'opening_balance' => $amount, 'reason' => mb_substr($this->option('reason'), 0, 500)]);
        });
        $this->info('Online wallet created. Offline delivery is blocked for this license. Install and pair the online runtime.');

        return self::SUCCESS;
    }
}
