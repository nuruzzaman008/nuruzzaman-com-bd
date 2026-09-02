<?php

namespace App\Console\Commands;

use App\Enums\EnrollmentStatus;
use App\Models\Cart;
use App\Models\Enrollment;
use App\Models\IdempotencyKey;
use Illuminate\Console\Command;

class PlatformHousekeeping extends Command
{
    protected $signature = 'platform:housekeeping';

    protected $description = 'Expire stale carts and enrolments and prune spent idempotency keys.';

    public function handle(): int
    {
        $carts = Cart::query()
            ->where('status', 'open')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->update(['status' => 'expired']);

        $enrollments = Enrollment::query()
            ->where('status', EnrollmentStatus::Active->value)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->update(['status' => EnrollmentStatus::Expired->value]);

        // Replay protection only needs to cover the retry window of a client.
        $keys = IdempotencyKey::query()
            ->where('created_at', '<', now()->subDays(7))
            ->delete();

        $this->info("Carts expired: {$carts}, enrolments expired: {$enrollments}, idempotency keys pruned: {$keys}.");

        return self::SUCCESS;
    }
}
