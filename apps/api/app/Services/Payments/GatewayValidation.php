<?php

namespace App\Services\Payments;

/**
 * The result of a server-to-server verification call. A return URL hit alone
 * never produces one of these; only the gateway's own validation API does.
 */
final class GatewayValidation
{
    public function __construct(
        public readonly bool $isValid,
        public readonly string $status,
        public readonly ?string $transactionId = null,
        public readonly ?string $bankTransactionId = null,
        public readonly ?int $amountMinor = null,
        public readonly ?string $currency = null,
        public readonly ?string $riskLevel = null,
        public readonly ?string $riskTitle = null,
        public readonly ?string $cardType = null,
        public readonly ?string $error = null,
        public readonly array $raw = [],
    ) {}

    public function isRisky(): bool
    {
        return $this->riskLevel !== null && $this->riskLevel !== '0';
    }

    public static function failed(string $error, array $raw = []): self
    {
        return new self(false, 'FAILED', error: $error, raw: $raw);
    }
}
