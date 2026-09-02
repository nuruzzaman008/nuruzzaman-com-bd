<?php

namespace App\Services\Payments;

final class GatewayRefund
{
    public function __construct(
        public readonly bool $accepted,
        public readonly ?string $refundReference = null,
        public readonly ?string $error = null,
        public readonly array $raw = [],
    ) {}
}
