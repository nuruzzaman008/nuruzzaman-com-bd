<?php

namespace App\Services\Receipts;

use App\Enums\PaymentStatus;
use App\Models\Invoice;
use App\Models\Order;
use App\Support\AmountInWords;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use Mpdf\Mpdf;
use Mpdf\Output\Destination;

/**
 * The money receipt for a paid order, as a PDF: what was bought, what was
 * paid, how, and the transaction it came from.
 *
 * It is drawn once, when the invoice is first needed, and kept on the private
 * disk beside it (the invoice's document_disk / document_path), so the email
 * and every later download are the same document. mPDF rather than a browser:
 * it is plain PHP, which this host needs, and it shapes Bengali - a course
 * title or a customer's name in Bangla prints as Bangla.
 */
class MoneyReceipt
{
    /** How the payment methods read on paper. */
    private const METHODS = [
        'bkash' => 'bKash',
        'nagad' => 'Nagad',
        'rocket' => 'Rocket',
        'bank' => 'Bank transfer',
    ];

    /**
     * The receipt's invoice with its PDF in place, drawing it if it is not
     * there yet. Null when the order has no invoice - it has not been paid.
     */
    public function ensureFor(Order $order): ?Invoice
    {
        $order->loadMissing(['invoice', 'items']);
        $invoice = $order->invoice;

        if (! $invoice) {
            return null;
        }

        $disk = $invoice->document_disk ?: (string) config('nb.downloads.disk');

        if ($invoice->document_path && Storage::disk($disk)->exists($invoice->document_path)) {
            return $invoice;
        }

        $path = 'receipts/'.($invoice->issued_at ?? now())->format('Y/m').'/'.$invoice->number.'.pdf';
        Storage::disk($disk)->put($path, $this->render($order, $invoice));
        $invoice->forceFill(['document_disk' => $disk, 'document_path' => $path])->save();

        return $invoice;
    }

    /** The PDF itself, as bytes. */
    public function render(Order $order, Invoice $invoice): string
    {
        $temp = storage_path('app/mpdf');
        File::ensureDirectoryExists($temp);

        $pdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'margin_left' => 14,
            'margin_right' => 14,
            'margin_top' => 12,
            'margin_bottom' => 14,
            'tempDir' => $temp,
            'default_font' => 'dejavusans',
            // Bangla text is found and set in a font that can shape it.
            'autoScriptToLang' => true,
            'autoLangToFont' => true,
        ]);

        $site = config('nb.site');
        $pdf->SetTitle('Money receipt '.$invoice->number);
        $pdf->SetAuthor((string) $site['name']);
        $pdf->SetCreator((string) $site['url']);
        $pdf->WriteHTML(View::make('documents.money-receipt', $this->data($order, $invoice))->render());

        return $pdf->Output('', Destination::STRING_RETURN);
    }

    /** Everything the receipt prints, gathered in one place. */
    public function data(Order $order, Invoice $invoice): array
    {
        $site = config('nb.site');
        $snapshot = $invoice->snapshot ?? [];
        $zone = (string) ($site['timezone'] ?? 'Asia/Dhaka');

        return [
            'site' => $site,
            'host' => parse_url((string) $site['url'], PHP_URL_HOST) ?: (string) $site['url'],
            'invoice' => $invoice,
            'order' => $order,
            'items' => $snapshot['items'] ?? [],
            'subtotal' => (int) ($snapshot['subtotal_minor'] ?? $invoice->total_minor),
            'discount' => (int) ($snapshot['discount_minor'] ?? 0),
            'tax' => (int) ($snapshot['tax_minor'] ?? 0),
            'total' => (int) $invoice->total_minor,
            'words' => AmountInWords::taka((int) $invoice->total_minor),
            'payment' => $this->payment($order),
            'issuedAt' => ($invoice->issued_at ?? now())->copy()->timezone($zone),
            'paidAt' => $order->paid_at?->copy()->timezone($zone),
        ];
    }

    /** @return array{method: string, reference: ?string} */
    private function payment(Order $order): array
    {
        $manual = DB::table('manual_payment_submissions')
            ->where('order_id', $order->getKey())
            ->where('status', 'approved')
            ->orderByDesc('id')
            ->first(['method', 'transaction_id']);

        if ($manual) {
            return [
                'method' => self::METHODS[$manual->method] ?? ucfirst((string) $manual->method),
                'reference' => $manual->transaction_id,
            ];
        }

        $online = $order->payments()
            ->where('status', PaymentStatus::Validated->value)
            ->latest('id')
            ->first();

        if ($online) {
            return [
                'method' => trim('Card / online '.($online->card_type ? '('.$online->card_type.')' : '')),
                'reference' => $online->bank_transaction_id ?: $online->gateway_transaction_id ?: $online->reference,
            ];
        }

        return [
            'method' => (int) $order->total_minor === 0 ? 'Free' : 'Recorded by the site',
            'reference' => null,
        ];
    }
}
