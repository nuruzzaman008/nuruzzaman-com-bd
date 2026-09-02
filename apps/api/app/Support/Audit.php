<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Request;

final class Audit
{
    /** Keys whose values are replaced before anything is persisted. */
    private const REDACTED = [
        'password', 'password_confirmation', 'current_password', 'token',
        'access_token', 'store_passwd', 'store_password', 'secret', 'api_key',
        'machine_id', 'mfa_secret', 'signature',
    ];

    public static function record(string $action, ?Model $subject = null, array $context = [], ?int $userId = null): AuditLog
    {
        return AuditLog::create([
            'user_id' => $userId ?? auth()->id(),
            'action' => $action,
            'auditable_type' => $subject?->getMorphClass(),
            'auditable_id' => $subject?->getKey(),
            'context' => self::redact($context),
            'ip_address' => Request::ip(),
            'request_id' => Request::header('X-Request-Id'),
            'created_at' => now(),
        ]);
    }

    /** @return array<string, mixed> */
    public static function redact(array $context): array
    {
        foreach ($context as $key => $value) {
            if (is_array($value)) {
                $context[$key] = self::redact($value);

                continue;
            }

            if (in_array(strtolower((string) $key), self::REDACTED, true)) {
                $context[$key] = '[redacted]';
            }
        }

        return $context;
    }
}
