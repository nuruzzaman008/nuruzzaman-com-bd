<?php

namespace App\Services\Payments;

final class GatewaySession
{
    public function __construct(
        public readonly string $redirectUrl,
        public readonly ?string $sessionKey = null,
        public readonly array $raw = [],
    ) {}
}
