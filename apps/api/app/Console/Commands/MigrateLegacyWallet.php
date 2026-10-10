<?php

namespace App\Console\Commands;

use App\Models\SoftwareLicense;
use App\Models\User;
use App\Services\Licensing\LegacyWalletMigrationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MigrateLegacyWallet extends Command
{
    protected $signature = 'wallet:migrate-legacy {manifest : Local reviewed JSON evidence file} {--admin-email= : Authorized administrative actor} {--apply : Commit the reviewed one-time credit; otherwise roll back a validation run}';

    protected $description = 'Validate or apply an audited legacy wallet cutover without changing reserved funds';

    public function handle(LegacyWalletMigrationService $service): int
    {
        $path = $this->argument('manifest');
        if (! is_file($path) || ! is_readable($path) || filesize($path) > 16384) {
            $this->error('Manifest must be a readable local JSON file under 16 KB.');

            return self::FAILURE;
        }
        $input = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        $admin = User::where('email', $this->option('admin-email'))->firstOrFail();
        $license = SoftwareLicense::where('license_code', $input['license_code'] ?? '')->firstOrFail();
        DB::beginTransaction();
        try {
            $result = $service->migrate($admin, $license->id, $input);
            if ($this->option('apply')) {
                DB::commit();
            } else {
                DB::rollBack();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
        $this->line(json_encode(['mode' => $this->option('apply') ? 'applied_or_previously_applied' : 'dry_run_rolled_back', 'result' => $result['data']], JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
