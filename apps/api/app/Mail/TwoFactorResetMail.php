<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Tells a staff member that someone cleared their two-step verification. */
class TwoFactorResetMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly User $user, public readonly string $resetBy) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your two-step verification was reset');
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.two-factor-reset', with: [
            'user' => $this->user,
            'resetBy' => $this->resetBy,
            'site' => config('nb.site'),
        ]);
    }
}
