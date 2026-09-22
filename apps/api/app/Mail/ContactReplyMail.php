<?php

namespace App\Mail;

use App\Models\ContactMessage;
use App\Models\ContactMessageReply;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * A reply to someone who wrote through the contact form. They have no
 * account, so this email is the whole conversation from their side; their own
 * message is quoted under the answer so the reply makes sense on its own.
 *
 * Escaped HTML rather than markdown, for the same reason as NotificationMail:
 * the quoted message is a stranger's text.
 */
class ContactReplyMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly ContactMessage $contact,
        public readonly ContactMessageReply $reply,
        public readonly string $staffName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Re: '.$this->contact->subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.contact-reply',
            text: 'mail.contact-reply-text',
            with: [
                'site' => config('nb.site'),
                'name' => $this->contact->name,
                'answer' => $this->reply->body,
                'staffName' => $this->staffName,
                'original' => $this->contact->message,
                'subject' => $this->contact->subject,
            ],
        );
    }
}
