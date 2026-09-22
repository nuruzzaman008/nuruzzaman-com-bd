<?php

namespace App\Notifications;

use App\Models\User;

/**
 * Every kind of notification the site sends, and the rules for each.
 *
 * The value is what is stored in notifications.type. A notification is a key
 * plus the facts about the event (order number, amount, names), never a
 * finished sentence: it is worded when it is shown, in the reader's language
 * (NotificationPresenter), so a Bengali and an English dashboard agree.
 */
enum NotificationType: string
{
    // To staff.
    case OrderPaid = 'order.paid';
    case PaymentSubmitted = 'payment.submitted';
    case ActivationRequested = 'activation.requested';
    case TicketOpened = 'ticket.opened';
    case TicketCustomerReplied = 'ticket.customer_replied';
    case ContactReceived = 'contact.received';
    case QuestionAsked = 'question.asked';
    case CommentPending = 'comment.pending';
    case UserRegistered = 'user.registered';
    case AffiliateJoined = 'affiliate.joined';
    case SecurityLockout = 'security.lockout';

    // To the customer, about their own orders, requests and courses.
    case OrderConfirmed = 'order.confirmed';
    case ActivationUpdated = 'activation.updated';
    case TicketStaffReplied = 'ticket.staff_replied';
    case QuestionAnswered = 'question.answered';
    case CourseAnnouncement = 'course.announcement';

    public const STAFF_CATEGORIES = ['orders', 'licences', 'support', 'learning', 'content', 'users', 'security'];

    public const CUSTOMER_CATEGORIES = ['orders', 'licences', 'support', 'learning'];

    public function forStaff(): bool
    {
        return ! in_array($this, [
            self::OrderConfirmed, self::ActivationUpdated, self::TicketStaffReplied,
            self::QuestionAnswered, self::CourseAnnouncement,
        ], true);
    }

    public function category(): string
    {
        return match ($this) {
            self::OrderPaid, self::PaymentSubmitted, self::OrderConfirmed => 'orders',
            self::ActivationRequested, self::ActivationUpdated => 'licences',
            self::TicketOpened, self::TicketCustomerReplied, self::ContactReceived,
            self::TicketStaffReplied => 'support',
            self::QuestionAsked, self::QuestionAnswered, self::CourseAnnouncement => 'learning',
            self::CommentPending => 'content',
            self::UserRegistered, self::AffiliateJoined => 'users',
            self::SecurityLockout => 'security',
        };
    }

    /** The permission a staff member needs to be told. Super admins hold every one. */
    public function permission(): ?string
    {
        return match ($this) {
            self::OrderPaid => 'orders.view',
            self::PaymentSubmitted => 'orders.manage',
            self::ActivationRequested => 'activation.review',
            self::TicketOpened, self::TicketCustomerReplied, self::ContactReceived => 'support.manage',
            // Narrowed to the course's own teachers in NotificationRouter.
            self::QuestionAsked => 'courses.manage',
            self::CommentPending => 'comments.moderate',
            self::UserRegistered => 'users.view',
            self::AffiliateJoined => 'affiliates.manage',
            self::SecurityLockout => 'settings.manage',
            default => null,
        };
    }

    /**
     * False where the site already sends its own email for the event (the
     * receipt, the activation decision, the answer), so nobody gets two.
     */
    public function hasEmail(): bool
    {
        return ! in_array($this, [self::OrderConfirmed, self::ActivationUpdated, self::QuestionAnswered], true);
    }

    /**
     * Email when the person has not chosen. Administrators hear about money,
     * licences, support and security by email; new sign-ups and comments stay
     * in the dashboard unless asked for. Other staff opt in. Customers get
     * email about their own things.
     */
    public function emailByDefault(User $user): bool
    {
        return $this->forStaff()
            ? self::staffEmailDefault($user, $this->category())
            : true;
    }

    public static function staffEmailDefault(User $user, string $category): bool
    {
        return $user->hasRole('super_admin', 'admin')
            && in_array($category, ['orders', 'licences', 'support', 'security'], true);
    }

    /** @return list<string> */
    public static function categoriesFor(User $user): array
    {
        return $user->isStaff() ? self::STAFF_CATEGORIES : self::CUSTOMER_CATEGORIES;
    }

    /** @return list<string> */
    public static function valuesInCategory(string $category): array
    {
        return array_values(array_map(
            fn (self $type) => $type->value,
            array_filter(self::cases(), fn (self $type) => $type->category() === $category),
        ));
    }
}
