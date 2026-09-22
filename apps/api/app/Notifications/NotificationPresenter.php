<?php

namespace App\Notifications;

use Illuminate\Support\Str;

/**
 * How a notification reads: a title, a one-line summary, an optional longer
 * detail (the customer's own words) and the page it opens.
 *
 * Both the dashboard and the email use this, so they never disagree. The text
 * is plain: every value came from a person (a name, a ticket subject) and is
 * escaped wherever it is shown, never trusted as markup.
 */
final class NotificationPresenter
{
    private const TEXT = [
        'bn' => [
            'order.paid' => 'নতুন পেইড অর্ডার',
            'payment.submitted' => 'পেমেন্ট যাচাইয়ের অপেক্ষায়',
            'activation.requested' => 'নতুন activation অনুরোধ',
            'ticket.opened' => 'নতুন support ticket',
            'ticket.customer_replied' => 'গ্রাহক ticket-এ উত্তর দিয়েছেন',
            'contact.received' => 'নতুন যোগাযোগ বার্তা',
            'question.asked' => 'নতুন প্রশ্ন',
            'comment.pending' => 'মন্তব্য অনুমোদনের অপেক্ষায়',
            'user.registered' => 'নতুন অ্যাকাউন্ট খোলা হয়েছে',
            'affiliate.joined' => 'নতুন affiliate যোগ দিয়েছেন',
            'security.lockout' => 'একটি অ্যাকাউন্ট সাময়িকভাবে লক হয়েছে',
            'order.confirmed' => 'আপনার অর্ডার নিশ্চিত হয়েছে',
            'activation.updated' => 'Activation অনুরোধের অবস্থা বদলেছে',
            'ticket.staff_replied' => 'Support টিম আপনার ticket-এ উত্তর দিয়েছে',
            'question.answered' => 'আপনার প্রশ্নের উত্তর এসেছে',
            'course.announcement' => 'কোর্সে নতুন ঘোষণা',
            'lockout.password' => 'ভুল পাসওয়ার্ড',
            'lockout.mfa' => 'ভুল 2-step কোড',
            'status' => 'অবস্থা',
            'reason' => 'কারণ',
        ],
        'en' => [
            'order.paid' => 'New paid order',
            'payment.submitted' => 'Payment waiting for review',
            'activation.requested' => 'New activation request',
            'ticket.opened' => 'New support ticket',
            'ticket.customer_replied' => 'Customer replied to a ticket',
            'contact.received' => 'New contact message',
            'question.asked' => 'New student question',
            'comment.pending' => 'Comment awaiting approval',
            'user.registered' => 'New account registered',
            'affiliate.joined' => 'New affiliate joined',
            'security.lockout' => 'An account was locked for a while',
            'order.confirmed' => 'Your order is confirmed',
            'activation.updated' => 'Your activation request changed',
            'ticket.staff_replied' => 'Support replied to your ticket',
            'question.answered' => 'Your question has an answer',
            'course.announcement' => 'New course announcement',
            'lockout.password' => 'wrong passwords',
            'lockout.mfa' => 'wrong two-step codes',
            'status' => 'Status',
            'reason' => 'Reason',
        ],
    ];

    private const ACTIVATION_STATUS = [
        'bn' => [
            'submitted' => 'জমা হয়েছে', 'under_review' => 'পর্যালোচনাধীন', 'needs_info' => 'আরও তথ্য প্রয়োজন',
            'approved' => 'অনুমোদিত', 'completed' => 'সম্পন্ন', 'deactivated' => 'নিষ্ক্রিয়',
            'rejected' => 'প্রত্যাখ্যাত', 'cancelled' => 'বাতিল',
        ],
        'en' => [
            'submitted' => 'Submitted', 'under_review' => 'Under review', 'needs_info' => 'More information needed',
            'approved' => 'Approved', 'completed' => 'Completed', 'deactivated' => 'Deactivated',
            'rejected' => 'Rejected', 'cancelled' => 'Cancelled',
        ],
    ];

    private const METHODS = ['bkash' => 'bKash', 'nagad' => 'Nagad', 'rocket' => 'Rocket', 'upay' => 'Upay'];

    /**
     * @param  array<string, mixed>  $data
     * @return array{type: string, category: string, title: string, body: string, detail: ?string, url: ?string, conversation: ?array{kind: string, key: string}, person_name: ?string}|null
     */
    public static function present(string $type, array $data, string $locale): ?array
    {
        $kind = NotificationType::tryFrom($type);
        if (! $kind) {
            return null;
        }

        $locale = $locale === 'en' ? 'en' : 'bn';
        $t = self::TEXT[$locale];
        $s = fn (string $key): ?string => self::text($data, $key);

        [$title, $body, $detail, $url] = match ($kind) {
            NotificationType::OrderPaid => [
                self::join([$t['order.paid'], $s('number')]),
                self::join([$s('customer'), self::money($data)]),
                null,
                self::path('/dashboard/orders', $s('number')),
            ],
            NotificationType::PaymentSubmitted => [
                self::join([$t['payment.submitted'], $s('number')]),
                self::join([$s('customer'), self::METHODS[$s('method') ?? ''] ?? $s('method'), self::money($data)]),
                null,
                '/dashboard/payments',
            ],
            NotificationType::ActivationRequested => [
                self::join([$t['activation.requested'], $s('reference')]),
                self::join([$s('customer'), $s('product'), $s('autocad_version')]),
                $s('note'),
                self::path('/dashboard/activation-requests', $s('reference')),
            ],
            NotificationType::TicketOpened, NotificationType::TicketCustomerReplied => [
                self::join([$t[$type], $s('reference')]),
                self::join([$s('customer'), $s('subject')]),
                $s('excerpt'),
                self::chat('ticket', $s('reference')),
            ],
            NotificationType::ContactReceived => [
                $t['contact.received'],
                self::join([$s('name'), $s('email'), $s('subject')]),
                $s('excerpt'),
                self::chat('contact', $s('contact_message_id')),
            ],
            NotificationType::QuestionAsked => [
                self::join([$t['question.asked'], $s('course')]),
                self::join([$s('customer'), $s('title')]),
                $s('excerpt'),
                self::chat('question', $s('question_id')),
            ],
            NotificationType::CommentPending => [
                $t['comment.pending'],
                self::join([$s('author'), $s('post')]),
                $s('excerpt'),
                self::chat('comment', $s('comment_id')),
            ],
            NotificationType::UserRegistered => [
                $t['user.registered'],
                self::join([$s('name'), $s('email')]),
                null,
                self::path('/dashboard/users', $s('user_id')),
            ],
            NotificationType::AffiliateJoined => [
                $t['affiliate.joined'],
                self::join([$s('name'), $s('code')]),
                null,
                '/dashboard/affiliates',
            ],
            NotificationType::SecurityLockout => [
                $t['security.lockout'],
                self::join([$s('email'), $t[$s('kind') === 'mfa' ? 'lockout.mfa' : 'lockout.password'], $s('ip')]),
                null,
                '/dashboard/audit-log',
            ],
            NotificationType::OrderConfirmed => [
                self::join([$t['order.confirmed'], $s('number')]),
                self::money($data) ?? '',
                null,
                self::path('/account/orders', $s('number')),
            ],
            NotificationType::ActivationUpdated => [
                $t['activation.updated'],
                self::join([
                    $s('reference'),
                    $s('status') ? $t['status'].': '.(self::ACTIVATION_STATUS[$locale][$s('status')] ?? $s('status')) : null,
                ]),
                $s('note'),
                self::path('/account/activation-requests', $s('reference')),
            ],
            NotificationType::TicketStaffReplied => [
                self::join([$t['ticket.staff_replied'], $s('reference')]),
                $s('subject') ?? '',
                $s('excerpt'),
                $s('reference') ? '/account/support?ticket='.rawurlencode($s('reference')) : '/account/support',
            ],
            NotificationType::QuestionAnswered => [
                $t['question.answered'],
                self::join([$s('course'), $s('title')]),
                $s('excerpt'),
                $s('lesson_slug') && $s('course_slug')
                    ? '/learn/'.rawurlencode($s('course_slug')).'/'.rawurlencode($s('lesson_slug'))
                    : self::path('/account/courses', $s('course_slug')),
            ],
            NotificationType::CourseAnnouncement => [
                self::join([$t['course.announcement'], $s('course')]),
                $s('title') ?? '',
                $s('excerpt'),
                self::path('/account/courses', $s('course_slug')),
            ],
        };

        return [
            'type' => $type,
            'category' => $kind->category(),
            'title' => $title,
            'body' => $body,
            'detail' => $detail,
            'url' => $url,
            'conversation' => self::conversation($kind, $data),
            // The person the notification is about, for the name and photo
            // beside it. Customers' notifications come from the site itself.
            'person_name' => $kind->forStaff()
                ? ($s('customer') ?? $s('name') ?? $s('author') ?? $s('email'))
                : null,
        ];
    }

    /**
     * The conversation a notification belongs to, so the bell can open it in
     * the chat window.
     *
     * @param  array<string, mixed>  $data
     * @return array{kind: string, key: string}|null
     */
    private static function conversation(NotificationType $kind, array $data): ?array
    {
        [$conversation, $field] = match ($kind) {
            NotificationType::TicketOpened, NotificationType::TicketCustomerReplied,
            NotificationType::TicketStaffReplied => ['ticket', 'reference'],
            NotificationType::ContactReceived => ['contact', 'contact_message_id'],
            NotificationType::QuestionAsked => ['question', 'question_id'],
            NotificationType::CommentPending => ['comment', 'comment_id'],
            default => [null, null],
        };
        $key = $field ? self::text($data, $field) : null;

        return $conversation && $key ? ['kind' => $conversation, 'key' => $key] : null;
    }

    /** The dashboard message inbox, open at one conversation when it is known. */
    private static function chat(string $kind, ?string $key): string
    {
        return $key === null ? '/dashboard/messages' : '/dashboard/messages?c='.$kind.':'.rawurlencode($key);
    }

    /** A short, single-line excerpt of something a person wrote. */
    public static function excerpt(?string $text, int $limit = 180): ?string
    {
        $flat = trim((string) preg_replace('/\s+/u', ' ', strip_tags((string) $text)));

        return $flat === '' ? null : Str::limit($flat, $limit);
    }

    /** @param  array<string, mixed>  $data */
    private static function text(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;
        if (! is_scalar($value)) {
            return null;
        }
        $value = trim((string) $value);

        return $value === '' ? null : Str::limit($value, 300);
    }

    /** @param  array<string, mixed>  $data */
    private static function money(array $data): ?string
    {
        $minor = $data['amount_minor'] ?? null;
        if (! is_int($minor) && ! (is_string($minor) && preg_match('/^-?\d{1,15}$/', $minor))) {
            return null;
        }
        $currency = is_string($data['currency'] ?? null) ? $data['currency'] : 'BDT';
        $amount = number_format(((int) $minor) / 100, 2);

        return $currency === 'BDT' ? '৳ '.$amount : $currency.' '.$amount;
    }

    /** A dashboard or account path; the reference is one encoded segment, so it cannot leave the site. */
    private static function path(string $base, ?string $reference): string
    {
        return $reference === null ? $base : $base.'/'.rawurlencode($reference);
    }

    /** @param  list<?string>  $parts */
    private static function join(array $parts): string
    {
        return implode(' · ', array_values(array_filter($parts, fn ($part) => $part !== null && $part !== '')));
    }
}
