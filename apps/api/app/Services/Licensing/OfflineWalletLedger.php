<?php

namespace App\Services\Licensing;

/**
 * Backend API boundary; admin adjustments use the existing staff permissions.
 * Authentication/licensing/payment remain owned by their existing services.
 * Implementations must authorize the confirmed device and lock the wallet row.
 * Every mutating request requires a UUID, canonical request hash and version check.
 * Retries return the original response; changed payload with the same UUID is rejected.
 */
interface OfflineWalletLedger
{
    /** @return array{license_id: int, available_balance: int, reserved_balance: int, status: string, version: int} */
    public function balance(int $authorizedLicenseId): array;

    /**
     * Append an adjustment with positive amount; never overwrite historical entries.
     *
     * @param  'credit'|'debit'  $type
     * @return array<string, mixed>
     */
    public function adjust(int $authorizedLicenseId, string $transactionId, string $type, int $amount, string $source, int $createdBy, string $reason, int $expectedVersion, string $referenceNote): array;

    /**
     * Reserve only available funds; never grant a client-supplied opening balance.
     *
     * @return array<string, mixed>
     */
    public function reserve(int $authorizedLicenseId, int $confirmedDeviceId, string $requestId, int $allowance, int $expectedVersion, OfflineWalletPolicy $policy): array;

    /**
     * Verify lease ownership, ordered sequence, payload identity and server-priced usage.
     * Settle atomically: subtract spent funds from both balance and reserved_balance.
     * Expiry alone does not release funds. An uncertain lease requires reconciliation.
     *
     * @param  array<int, array{transaction_id: string, sequence: int, command: string, units: int, occurred_at: string}>  $usage
     * @return array<string, mixed>
     */
    public function sync(int $confirmedDeviceId, string $requestId, string $leaseId, int $expectedVersion, array $usage): array;

    /** @return array<string, mixed> */
    public function history(int $authorizedLicenseId, ?string $cursor, int $limit): array;
}
