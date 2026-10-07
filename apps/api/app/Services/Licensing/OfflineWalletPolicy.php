<?php

namespace App\Services\Licensing;

use InvalidArgumentException;

final readonly class OfflineWalletPolicy
{
    public function __construct(
        public int $version,
        public int $maxAllowance,
        public int $leaseSeconds,
        public int $syncIntervalSeconds,
        public int $maxBatchSize,
    ) {
        if ($version < 1 || $maxAllowance < 1 || $maxAllowance > 1000000 || $leaseSeconds < 60 || $leaseSeconds > 604800 || $syncIntervalSeconds < 60 || $syncIntervalSeconds > $leaseSeconds || $maxBatchSize < 1 || $maxBatchSize > 1000) {
            throw new InvalidArgumentException('Invalid offline wallet policy.');
        }
    }

    public static function configured(): self
    {
        return new self(
            config('offline_wallet.policy_version'),
            config('offline_wallet.max_allowance'),
            config('offline_wallet.lease_seconds'),
            config('offline_wallet.sync_interval_seconds'),
            config('offline_wallet.max_batch_size'),
        );
    }
}
