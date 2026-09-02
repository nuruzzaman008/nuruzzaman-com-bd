<?php

namespace App\Mail;

use App\Models\ActivationRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ActivationStatusMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly ActivationRequest $request) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Activation request '.$this->request->reference.' updated');
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.activation-status', with: [
            'request' => $this->request,
            'site' => config('nb.site'),
        ]);
    }
}
