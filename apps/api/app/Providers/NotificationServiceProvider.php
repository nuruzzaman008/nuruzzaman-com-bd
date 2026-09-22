<?php

namespace App\Providers;

use App\Models\ActivationRequestEvent;
use App\Models\AuditLog;
use App\Models\CourseQuestion;
use App\Models\CourseQuestionReply;
use App\Models\NotificationEmail;
use App\Models\OrderStatusEvent;
use App\Models\PostComment;
use App\Models\SupportTicketMessage;
use App\Services\Notifications\NotificationRouter;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Throwable;

/**
 * Connects the notification center to the rest of the site.
 *
 * Its own provider, so the notification wiring lives in one place and none of
 * the order, ticket or course code has to change to be heard.
 */
class NotificationServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $route = fn (string $method) => fn ($model) => app(NotificationRouter::class)->{$method}($model);

        OrderStatusEvent::created($route('orderStatusChanged'));
        SupportTicketMessage::created($route('ticketMessage'));
        CourseQuestion::created($route('question'));
        CourseQuestionReply::created($route('questionReply'));
        PostComment::created($route('comment'));
        ActivationRequestEvent::created($route('activationEvent'));
        AuditLog::created(function (AuditLog $log) {
            if (in_array($log->action, NotificationRouter::AUDIT_ACTIONS, true)) {
                app(NotificationRouter::class)->audit($log);
            }
        });

        Event::listen(MessageSent::class, fn (MessageSent $event) => $this->logEmail($event));
    }

    /**
     * Records the site's other emails (receipts, answers, password resets) in
     * the email log as they go out. Notification emails log themselves.
     */
    private function logEmail(MessageSent $event): void
    {
        try {
            $message = $event->message;
            if ($message->getHeaders()->has('X-NB-Notification-Email')) {
                return;
            }

            $class = $event->data['__laravel_mailable'] ?? $event->data['__laravel_notification'] ?? null;
            $to = collect($message->getTo())->map(fn ($address) => $address->getAddress())->implode(', ');

            NotificationEmail::query()->create([
                'source' => 'mail',
                'type' => is_string($class) ? class_basename($class) : 'mail',
                'recipient' => Str::limit($to, 250, ''),
                'subject' => Str::limit((string) $message->getSubject(), 250),
                'status' => NotificationEmail::SENT,
                'attempts' => 1,
                'last_attempt_at' => now(),
                'sent_at' => now(),
            ]);
        } catch (Throwable $exception) {
            // The email itself has gone; failing to log it must not look like
            // a failed send.
            report($exception);
        }
    }
}
