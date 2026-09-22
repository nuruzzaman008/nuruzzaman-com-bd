<?php

namespace App\Services\Notifications;

use App\Jobs\SendNotificationEmail;
use App\Models\NotificationEmail;
use Illuminate\Support\Facades\DB;

/**
 * Keeping the notification tables healthy: retrying emails that failed and
 * removing what nobody needs any more. Run by the scheduler, and on demand
 * from the email log.
 */
class NotificationMaintenance
{
    /** Read notifications are kept this long. Unread ones are never removed. */
    public const READ_RETENTION_DAYS = 90;

    /** Sent emails stay in the log this long. Failed ones are kept until resent. */
    public const SENT_EMAIL_RETENTION_DAYS = 180;

    /** Automatic retries stop here; the resend button still works after. */
    public const MAX_AUTOMATIC_ATTEMPTS = 5;

    /** How long a failed or stuck email waits before it is tried again. */
    public const RETRY_AFTER_MINUTES = 10;

    /** @return array{notifications: int, emails: int} */
    public function prune(): array
    {
        return [
            'notifications' => DB::table('notifications')
                ->whereNotNull('read_at')
                ->where('read_at', '<', now()->subDays(self::READ_RETENTION_DAYS))
                ->delete(),
            'emails' => NotificationEmail::query()
                ->where('status', NotificationEmail::SENT)
                ->where('sent_at', '<', now()->subDays(self::SENT_EMAIL_RETENTION_DAYS))
                ->delete(),
        ];
    }

    /**
     * Queues every notification email that failed, or was never picked up, and
     * has waited long enough. Returns how many were queued.
     */
    public function retryDue(bool $ignoreLimit = false): int
    {
        $ids = NotificationEmail::query()
            ->where('source', 'notification')
            ->whereIn('status', [NotificationEmail::FAILED, NotificationEmail::PENDING])
            ->when(! $ignoreLimit, fn ($query) => $query->where('attempts', '<', self::MAX_AUTOMATIC_ATTEMPTS))
            ->where(function ($query) {
                $cutoff = now()->subMinutes(self::RETRY_AFTER_MINUTES);
                $query->where('last_attempt_at', '<', $cutoff)
                    ->orWhere(fn ($never) => $never->whereNull('last_attempt_at')->where('created_at', '<', $cutoff));
            })
            ->orderBy('id')
            ->limit(200)
            ->pluck('id');

        foreach ($ids as $id) {
            SendNotificationEmail::dispatch($id);
        }

        return $ids->count();
    }

    /** Sends one email again now, whatever its attempt count. */
    public function retry(NotificationEmail $email): void
    {
        if ($email->source !== 'notification' || $email->status === NotificationEmail::SENT) {
            return;
        }

        // Cleared so the job's claim does not wait out the last attempt.
        $email->forceFill(['last_attempt_at' => null])->save();
        SendNotificationEmail::dispatch($email->getKey());
    }
}
