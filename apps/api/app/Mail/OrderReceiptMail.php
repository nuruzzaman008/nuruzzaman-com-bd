<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Attachment;
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

    /**
     * The money receipt PDF, when it has been drawn (SendOrderReceipt draws it
     * first). Without one the email still goes, as it always has.
     */
    public function attachments(): array
    {
        $invoice = $this->order->invoice;

        if (! $invoice?->document_path) {
            return [];
        }

        return [
            Attachment::fromStorageDisk($invoice->document_disk, $invoice->document_path)
                ->as('Money-receipt-'.$invoice->number.'.pdf')
                ->withMime('application/pdf'),
        ];
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.order-receipt', with: [
            'order' => $this->order,
            'site' => config('nb.site'),
        ]);
    }
}
