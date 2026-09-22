<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;

/**
 * A notification, by email. Plain escaped HTML rather than markdown: names,
 * subjects and messages come from visitors, and markdown would turn a
 * "[link](...)" in someone's ticket subject into a real link.
 */
class NotificationMail extends Mailable
{
    use Queueable;

    /**
     * @param  array{title: string, body: string, detail: ?string, url: ?string}  $notification
     */
    public function __construct(
        public readonly array $notification,
        public readonly string $lang,
        public readonly bool $forStaff,
        public readonly int $emailId,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->notification['title']);
    }

    /** Marks it as ours, so the email log does not record it a second time. */
    public function headers(): Headers
    {
        return new Headers(text: ['X-NB-Notification-Email' => (string) $this->emailId]);
    }

    public function content(): Content
    {
        $site = config('nb.site');
        $base = rtrim((string) $site['url'], '/');

        return new Content(
            view: 'mail.notification',
            text: 'mail.notification-text',
            with: [
                'site' => $site,
                'lang' => $this->lang,
                'title' => $this->notification['title'],
                'body' => $this->notification['body'],
                'detail' => $this->notification['detail'],
                'url' => $this->notification['url'] ? $base.$this->notification['url'] : null,
                'settingsUrl' => $base.($this->forStaff ? '/dashboard/notifications/settings' : '/account/notifications'),
            ],
        );
    }
}
