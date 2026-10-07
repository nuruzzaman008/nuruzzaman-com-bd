<?php

namespace App\Services\Licensing;

class WalletLeaseSigner
{
    public function sign(array $payload, string $keyId): string
    {
        $path = config('offline_wallet.signing_key_path');
        abort_unless(is_string($path) && is_file($path) && is_readable($path) && $keyId !== '', 503, 'Wallet lease signing is not configured.');
        $key = openssl_pkey_get_private(file_get_contents($path));
        $details = $key ? openssl_pkey_get_details($key) : false;
        abort_unless($details && $details['type'] === OPENSSL_KEYTYPE_RSA && $details['bits'] >= 2048, 503, 'Invalid wallet signing configuration.');
        $header = $this->encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT', 'kid' => $keyId], JSON_THROW_ON_ERROR));
        $body = $this->encode(json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
        abort_unless(openssl_sign($header.'.'.$body, $signature, $key, OPENSSL_ALGO_SHA256), 503, 'Lease signing failed.');

        return $header.'.'.$body.'.'.$this->encode($signature);
    }

    private function encode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
