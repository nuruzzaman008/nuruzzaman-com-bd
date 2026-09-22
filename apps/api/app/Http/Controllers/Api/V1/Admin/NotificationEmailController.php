<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\NotificationEmail;
use App\Notifications\NotificationPresenter;
use App\Services\Notifications\NotificationMaintenance;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * The email log, for administrators.
 *
 * Shows every email the site sent or tried to send, and the queued emails
 * whose job failed outright (those never reached the log). Recipient
 * addresses and failure reasons are personal and operational detail, which is
 * why this is limited to super admins and admins (routes/api_notifications.php).
 */
class NotificationEmailController extends Controller
{
    public function __construct(private readonly NotificationMaintenance $maintenance) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['sometimes', Rule::in(['all', NotificationEmail::PENDING, NotificationEmail::SENT, NotificationEmail::FAILED])],
            'source' => ['sometimes', Rule::in(['all', 'notification', 'mail'])],
            'page' => ['sometimes', 'integer', 'min:1'],
            'locale' => ['sometimes', Rule::in(['bn', 'en'])],
        ]);
        $locale = $validated['locale'] ?? $request->user()->locale;

        $page = NotificationEmail::query()
            ->when(($validated['status'] ?? 'all') !== 'all', fn ($query) => $query->where('status', $validated['status']))
            ->when(($validated['source'] ?? 'all') !== 'all', fn ($query) => $query->where('source', $validated['source']))
            ->latest('id')
            ->paginate(25);

        return response()->json([
            'data' => $page->getCollection()->map(fn (NotificationEmail $email) => [
                'id' => $email->id,
                'source' => $email->source,
                'type' => $email->type,
                'label' => $email->source === 'notification'
                    ? (NotificationPresenter::present($email->type, [], $locale)['title'] ?? $email->type)
                    : $email->type,
                'recipient' => $email->recipient,
                'subject' => $email->subject,
                'status' => $email->status,
                'attempts' => $email->attempts,
                'failure_reason' => $email->failure_reason,
                'can_retry' => $email->source === 'notification' && $email->status !== NotificationEmail::SENT,
                'created_at' => $email->created_at?->toIso8601String(),
                'sent_at' => $email->sent_at?->toIso8601String(),
                'last_attempt_at' => $email->last_attempt_at?->toIso8601String(),
            ])->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
                'summary' => $this->summary(),
            ],
            'failed_jobs' => $this->failedMailJobs(),
        ]);
    }

    public function retry(Request $request, NotificationEmail $email): JsonResponse
    {
        abort_unless($email->source === 'notification' && $email->status !== NotificationEmail::SENT, 422, 'Only unsent notification emails can be resent.');

        $this->maintenance->retry($email);
        Audit::record('notification_email.retried', $email, ['type' => $email->type]);

        return response()->json(['data' => ['queued' => 1]]);
    }

    public function retryFailed(Request $request): JsonResponse
    {
        $queued = $this->maintenance->retryDue(ignoreLimit: true);
        Audit::record('notification_email.retried_all', null, ['queued' => $queued]);

        return response()->json(['data' => ['queued' => $queued]]);
    }

    /** Puts a failed queued email (any kind) back on the queue. */
    public function retryJob(Request $request, string $uuid): JsonResponse
    {
        abort_unless(Str::isUuid($uuid), 404);
        $job = DB::table('failed_jobs')->where('uuid', $uuid)->first();
        abort_unless($job && $this->isMailJob($job->payload), 404);

        Artisan::call('queue:retry', ['id' => [$uuid]]);
        Audit::record('mail_job.retried', null, ['uuid' => $uuid]);

        return response()->json(['data' => ['queued' => 1]]);
    }

    public function prune(Request $request): JsonResponse
    {
        $removed = $this->maintenance->prune();
        Audit::record('notifications.pruned', null, $removed);

        return response()->json(['data' => $removed]);
    }

    /** @return array<string, mixed> */
    private function summary(): array
    {
        $mailer = (string) config('mail.default');

        return [
            'pending' => NotificationEmail::query()->where('status', NotificationEmail::PENDING)->count(),
            'failed' => NotificationEmail::query()->where('status', NotificationEmail::FAILED)->count(),
            'sent_last_7_days' => NotificationEmail::query()
                ->where('status', NotificationEmail::SENT)
                ->where('sent_at', '>=', now()->subDays(7))
                ->count(),
            // "log" and "array" write nowhere a person would read.
            'mail_delivers' => ! in_array($mailer, ['log', 'array'], true),
            'mailer' => $mailer,
        ];
    }

    /** @return list<array<string, string|null>> */
    private function failedMailJobs(): array
    {
        return DB::table('failed_jobs')
            ->latest('failed_at')
            ->limit(200)
            ->get(['uuid', 'payload', 'exception', 'failed_at'])
            ->filter(fn ($job) => $this->isMailJob($job->payload))
            ->take(50)
            ->map(fn ($job) => [
                'uuid' => $job->uuid,
                'job' => class_basename((string) (json_decode($job->payload, true)['displayName'] ?? 'mail')),
                'reason' => Str::limit(strtok((string) $job->exception, "\n") ?: '', 300),
                'failed_at' => $job->failed_at ? date(DATE_ATOM, strtotime((string) $job->failed_at)) : null,
            ])
            ->values()
            ->all();
    }

    private function isMailJob(?string $payload): bool
    {
        $name = (string) (json_decode((string) $payload, true)['displayName'] ?? '');

        return str_starts_with($name, 'App\\Mail\\')
            || str_ends_with($name, 'SendQueuedMailable')
            || $name === 'App\\Jobs\\SendOrderReceipt'
            || $name === 'App\\Jobs\\SendNotificationEmail';
    }
}
