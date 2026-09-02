<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OrderReceiptMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly Order $order) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Order '.$this->order->number.' confirmed');
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.order-receipt', with: [
            'order' => $this->order,
            'site' => config('nb.site'),
        ]);
    }
}
