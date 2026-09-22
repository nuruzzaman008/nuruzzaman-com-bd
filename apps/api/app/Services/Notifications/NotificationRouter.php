<?php

namespace App\Services\Notifications;

use App\Models\ActivationRequestEvent;
use App\Models\Affiliate;
use App\Models\AuditLog;
use App\Models\ContactMessage;
use App\Models\CourseAnnouncement;
use App\Models\CourseInstructor;
use App\Models\CourseQuestion;
use App\Models\CourseQuestionReply;
use App\Models\Enrollment;
use App\Models\OrderStatusEvent;
use App\Models\Payment;
use App\Models\PostComment;
use App\Models\SupportTicketMessage;
use App\Models\User;
use App\Notifications\NotificationPresenter;
use App\Notifications\NotificationType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;

/**
 * Turns things that happen on the site into notifications.
 *
 * Wired from NotificationServiceProvider as model "created" listeners, so the
 * controllers and services that make orders, tickets and questions do not have
 * to know notifications exist; the audit log covers the events that have no
 * model of their own (a manual payment, a lockout).
 */
class NotificationRouter
{
    /** Audit actions that become notifications. */
    public const AUDIT_ACTIONS = [
        'payment.manual_submitted', 'auth.registered', 'affiliate.joined',
        'auth.login_locked', 'auth.mfa_locked', 'contact.received', 'course.announcement.created',
    ];

    public function __construct(private readonly Notifier $notifier) {}

    public function orderStatusChanged(OrderStatusEvent $event): void
    {
        if ($event->to_status !== 'paid') {
            return;
        }

        $order = $event->order()->with('user')->first();
        if (! $order) {
            return;
        }

        $data = [
            'order_id' => $order->getKey(),
            'actor_id' => $order->user_id,
            'number' => $order->number,
            'amount_minor' => (int) $order->total_minor,
            'currency' => $order->currency,
            'customer' => $order->billing_name ?: $order->user?->name,
        ];

        $this->notifier->toStaff(NotificationType::OrderPaid, $data);
        $this->notifier->toUser($order->user, NotificationType::OrderConfirmed, $data);
    }

    public function ticketMessage(SupportTicketMessage $message): void
    {
        if ($message->is_internal) {
            return;
        }

        $ticket = $message->ticket()->with('user')->first();
        if (! $ticket) {
            return;
        }

        $data = [
            'ticket_id' => $ticket->getKey(),
            'actor_id' => $ticket->user_id,
            'reference' => $ticket->reference,
            'subject' => $ticket->subject,
            'customer' => $ticket->name ?: $ticket->user?->name,
            'excerpt' => NotificationPresenter::excerpt($message->body),
        ];

        if ($message->author_kind === 'staff') {
            $this->notifier->toUser($ticket->user, NotificationType::TicketStaffReplied, $data);

            return;
        }

        // The customer's first message is the ticket itself.
        $first = $ticket->messages()->where('author_kind', 'customer')->count() <= 1;
        $this->notifier->toStaff($first ? NotificationType::TicketOpened : NotificationType::TicketCustomerReplied, $data);
    }

    public function question(CourseQuestion $question): void
    {
        $question->loadMissing(['course', 'lesson', 'user']);

        // Administrators, and the teachers of this course - not every
        // instructor on the site.
        $teachers = CourseInstructor::query()->where('course_id', $question->course_id)->pluck('user_id');

        $this->notifier->toStaff(NotificationType::QuestionAsked, [
            'question_id' => $question->getKey(),
            'actor_id' => $question->user_id,
            'course' => $question->course?->title,
            'course_slug' => $question->course?->slug,
            'title' => $question->title,
            'customer' => $question->user?->name,
            'excerpt' => NotificationPresenter::excerpt($question->body),
        ], fn (Builder $staff) => $staff->where(fn (Builder $who) => $who
            ->whereHas('roles', fn (Builder $roles) => $roles->whereIn('name', ['super_admin', 'admin']))
            ->orWhereIn('users.id', $teachers)));
    }

    public function questionReply(CourseQuestionReply $reply): void
    {
        if (! $reply->from_instructor) {
            return;
        }

        $question = $reply->question()->with(['course', 'lesson', 'user'])->first();
        if (! $question || $question->user_id === $reply->user_id) {
            return;
        }

        $this->notifier->toUser($question->user, NotificationType::QuestionAnswered, [
            'question_id' => $question->getKey(),
            'course' => $question->course?->title,
            'course_slug' => $question->course?->slug,
            'lesson_slug' => $question->lesson?->slug,
            'title' => $question->title,
            'excerpt' => NotificationPresenter::excerpt($reply->body),
        ]);
    }

    public function comment(PostComment $comment): void
    {
        if (($comment->status?->value ?? $comment->status) !== 'pending') {
            return;
        }

        $comment->loadMissing(['post', 'user']);

        $this->notifier->toStaff(NotificationType::CommentPending, [
            'comment_id' => $comment->getKey(),
            'actor_id' => $comment->user_id,
            'post' => $comment->post?->title,
            'author' => $comment->author_name ?: $comment->user?->name,
            'excerpt' => NotificationPresenter::excerpt($comment->body),
        ]);
    }

    public function activationEvent(ActivationRequestEvent $event): void
    {
        $request = $event->request()->with('user')->first();
        if (! $request) {
            return;
        }

        if ($event->to_status === 'submitted' && $event->from_status === null) {
            $this->notifier->toStaff(NotificationType::ActivationRequested, [
                'activation_request_id' => $request->getKey(),
                'actor_id' => $request->user_id,
                'reference' => $request->reference,
                'customer' => $request->user?->name,
                'autocad_version' => $request->autocad_version ? 'AutoCAD '.$request->autocad_version : null,
                'note' => NotificationPresenter::excerpt($request->customer_note),
            ]);

            return;
        }

        // The customer's own changes are not news to them.
        if ($event->actor_id === null || $event->actor_id === $request->user_id) {
            return;
        }

        $this->notifier->toUser($request->user, NotificationType::ActivationUpdated, [
            'activation_request_id' => $request->getKey(),
            'reference' => $request->reference,
            'status' => $event->to_status,
        ]);
    }

    public function audit(AuditLog $log): void
    {
        match ($log->action) {
            'payment.manual_submitted' => $this->manualPayment($log),
            'auth.registered' => $this->registered($log),
            'affiliate.joined' => $this->affiliateJoined($log),
            'auth.login_locked', 'auth.mfa_locked' => $this->lockout($log),
            'contact.received' => $this->contact($log),
            'course.announcement.created' => $this->announcement($log),
            default => null,
        };
    }

    private function manualPayment(AuditLog $log): void
    {
        $payment = Payment::query()->with('order.user')->find($log->auditable_id);
        $order = $payment?->order;
        if (! $order) {
            return;
        }

        $this->notifier->toStaff(NotificationType::PaymentSubmitted, [
            'order_id' => $order->getKey(),
            'actor_id' => $order->user_id,
            'number' => $order->number,
            'amount_minor' => (int) $payment->amount_minor,
            'currency' => $payment->currency,
            'method' => $log->context['method'] ?? null,
            'customer' => $order->billing_name ?: $order->user?->name,
        ]);
    }

    private function registered(AuditLog $log): void
    {
        $user = User::query()->find($log->auditable_id);
        if (! $user) {
            return;
        }

        $this->notifier->toStaff(NotificationType::UserRegistered, [
            'user_id' => $user->getKey(),
            'actor_id' => $user->getKey(),
            'name' => $user->name,
            'email' => $user->email,
            'via' => $log->context['via'] ?? 'password',
        ]);
    }

    private function affiliateJoined(AuditLog $log): void
    {
        $affiliate = Affiliate::query()->with('user')->find($log->auditable_id);
        if (! $affiliate) {
            return;
        }

        $this->notifier->toStaff(NotificationType::AffiliateJoined, [
            'affiliate_id' => $affiliate->getKey(),
            'actor_id' => $affiliate->user_id,
            'name' => $affiliate->user?->name,
            'code' => $affiliate->code,
        ]);
    }

    /**
     * A lockout is worth knowing about once, not on every further attempt
     * against the locked account: one notification per account per hour.
     */
    private function lockout(AuditLog $log): void
    {
        $email = $log->context['email'] ?? User::query()->whereKey($log->auditable_id)->value('email');
        if (! $email) {
            return;
        }
        $kind = $log->action === 'auth.mfa_locked' ? 'mfa' : 'password';

        if (! Cache::add('notifications:lockout:'.$kind.':'.sha1(strtolower((string) $email)), true, now()->addHour())) {
            return;
        }

        $this->notifier->toStaff(NotificationType::SecurityLockout, [
            'email' => $email,
            'kind' => $kind,
            'ip' => $log->ip_address,
        ]);
    }

    private function contact(AuditLog $log): void
    {
        $message = ContactMessage::query()->find($log->auditable_id);
        if (! $message) {
            return;
        }

        $this->notifier->toStaff(NotificationType::ContactReceived, [
            'contact_message_id' => $message->getKey(),
            'name' => $message->name,
            'email' => $message->email,
            'subject' => $message->subject,
            'excerpt' => NotificationPresenter::excerpt($message->message, 600),
        ]);
    }

    /** Every student actively enrolled in the course. */
    private function announcement(AuditLog $log): void
    {
        $announcement = CourseAnnouncement::query()->with('course')->find($log->auditable_id);
        if (! $announcement || ! $announcement->course) {
            return;
        }

        $students = User::query()
            ->whereIn('id', Enrollment::query()
                ->where('course_id', $announcement->course_id)
                ->where('status', 'active')
                ->select('user_id'))
            ->where('status', 'active')
            ->get();

        $this->notifier->toUsers($students, NotificationType::CourseAnnouncement, [
            'announcement_id' => $announcement->getKey(),
            'course' => $announcement->course->title,
            'course_slug' => $announcement->course->slug,
            'title' => $announcement->title,
            'excerpt' => NotificationPresenter::excerpt($announcement->body_markdown, 300),
        ]);
    }
}
