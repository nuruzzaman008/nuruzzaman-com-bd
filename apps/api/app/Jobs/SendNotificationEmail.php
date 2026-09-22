<?php

namespace App\Jobs;

use App\Mail\NotificationMail;
use App\Models\NotificationEmail;
use App\Notifications\NotificationPresenter;
use App\Notifications\NotificationType;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

/**
 * Sends one notification email from the email log and records how it went.
 *
 * The queue does not retry it (tries = 1): the log does, so every attempt and
 * its failure reason stay visible (notifications:retry-emails, and the resend
 * button in Dashboard -> Notifications -> Email log).
 */
class SendNotificationEmail implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    /** A row someone else is sending right now is left alone. */
    private const CLAIM_SECONDS = 60;

    public function __construct(public readonly int $emailId) {}

    public function handle(): void
    {
        $claimed = NotificationEmail::query()
            ->whereKey($this->emailId)
            ->where('source', 'notification')
            ->where('status', '!=', NotificationEmail::SENT)
            ->where(fn ($query) => $query
                ->whereNull('last_attempt_at')
                ->orWhere('last_attempt_at', '<', now()->subSeconds(self::CLAIM_SECONDS)))
            ->update(['attempts' => DB::raw('attempts + 1'), 'last_attempt_at' => now()]);

        if ($claimed !== 1) {
            return;
        }

        $email = NotificationEmail::query()->findOrFail($this->emailId);
        $view = NotificationPresenter::present($email->type, $email->payload ?? [], $email->locale);

        if (! $view) {
            $this->failed($email, 'Unknown notification type');

            return;
        }

        try {
            Mail::to($email->recipient)->send(new NotificationMail(
                $view,
                $email->locale,
                NotificationType::from($email->type)->forStaff(),
                $email->getKey(),
            ));
        } catch (Throwable $exception) {
            $this->failed($email, $exception->getMessage());

            return;
        }

        $email->forceFill([
            'status' => NotificationEmail::SENT,
            'sent_at' => now(),
            'failed_at' => null,
            'failure_reason' => null,
        ])->save();
    }

    private function failed(NotificationEmail $email, string $reason): void
    {
        $email->forceFill([
            'status' => NotificationEmail::FAILED,
            'failed_at' => now(),
            'failure_reason' => Str::limit($reason, 500),
        ])->save();
    }
}
