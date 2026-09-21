<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Jobs\SendOrderReceipt;
use App\Mail\OrderReceiptMail;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Receipts\MoneyReceipt;
use App\Support\Reference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

/**
 * The money receipt PDF: drawn when a paid order's receipt email goes out,
 * attached to it, kept, and downloadable from the account.
 */
class MoneyReceiptTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('private');
        Mail::fake();
    }

    /** A paid order with its invoice, paid by bKash and approved. */
    private function paidOrder(?User $user = null): Order
    {
        $order = Order::factory()->for($user ?? $this->customer())->paid()->create([
            'billing_name' => 'Rahim Uddin',
            'billing_phone' => '01700000000',
            'subtotal_minor' => 1_580_000,
            'discount_minor' => 70_000,
            'total_minor' => 1_510_000,
        ]);

        Invoice::query()->create([
            'order_id' => $order->getKey(),
            'number' => 'INV-260921-AB12CD',
            'currency' => 'BDT',
            'total_minor' => 1_510_000,
            'issued_at' => now(),
            'snapshot' => [
                'order_number' => $order->number,
                'items' => [[
                    'name' => 'Basic English Sound (IPA) - Full course',
                    'sku' => 'COURSE-IPA',
                    'quantity' => 1,
                    'unit_price_minor' => 1_580_000,
                    'line_total_minor' => 1_580_000,
                ]],
                'subtotal_minor' => 1_580_000,
                'discount_minor' => 70_000,
                'tax_minor' => 0,
                'total_minor' => 1_510_000,
            ],
        ]);

        $payment = Payment::query()->create([
            'order_id' => $order->getKey(),
            'gateway' => 'manual',
            'reference' => Reference::payment(),
            'status' => PaymentStatus::Validated,
            'currency' => 'BDT',
            'amount_minor' => 1_510_000,
        ]);

        DB::table('manual_payment_submissions')->insert([
            'order_id' => $order->getKey(),
            'payment_id' => $payment->getKey(),
            'method' => 'bkash',
            'transaction_id' => 'BK7Q2X9ZLM',
            'sender' => '01700000000',
            'recipient' => '01800000000',
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $order->fresh();
    }

    public function test_the_receipt_email_carries_the_money_receipt_pdf(): void
    {
        $order = $this->paidOrder();

        (new SendOrderReceipt($order->getKey()))->handle();

        $invoice = $order->invoice()->first();
        $this->assertNotNull($invoice->document_path);
        Storage::disk('private')->assertExists($invoice->document_path);
        $this->assertStringStartsWith('%PDF', Storage::disk('private')->get($invoice->document_path));

        Mail::assertSent(OrderReceiptMail::class, function (OrderReceiptMail $mail) use ($order) {
            $attachments = $mail->attachments();

            return $mail->hasTo($order->billing_email)
                && count($attachments) === 1
                && $attachments[0]->as === 'Money-receipt-INV-260921-AB12CD.pdf'
                && $attachments[0]->mime === 'application/pdf';
        });
    }

    public function test_the_receipt_prints_the_order_the_payment_and_the_amount_in_words(): void
    {
        $order = $this->paidOrder();
        $receipts = app(MoneyReceipt::class);

        $html = view('documents.money-receipt', $receipts->data($order, $order->invoice))->render();

        foreach ([
            'MONEY RECEIPT', 'INV-260921-AB12CD', $order->number, 'Rahim Uddin', '01700000000',
            'Basic English Sound (IPA) - Full course', '15,800.00', '-700.00', '15,100.00',
            'Fifteen thousand one hundred taka only', 'bKash', 'BK7Q2X9ZLM', 'PAID',
            'system generated receipt',
        ] as $expected) {
            $this->assertStringContainsString($expected, $html, $expected);
        }

        // The site's own name, not anyone else's.
        $this->assertStringContainsString((string) config('nb.site.name'), $html);
    }

    public function test_a_card_payment_says_so(): void
    {
        $order = Order::factory()->for($this->customer())->paid()->create();
        Invoice::query()->create([
            'order_id' => $order->getKey(), 'number' => 'INV-CARD', 'currency' => 'BDT',
            'total_minor' => $order->total_minor, 'issued_at' => now(), 'snapshot' => ['items' => []],
        ]);
        Payment::query()->create([
            'order_id' => $order->getKey(), 'gateway' => 'sslcommerz', 'reference' => Reference::payment(),
            'status' => PaymentStatus::Validated, 'currency' => 'BDT', 'amount_minor' => $order->total_minor,
            'card_type' => 'VISA-Dutch Bangla', 'bank_transaction_id' => 'BANKTX123',
        ]);

        $data = app(MoneyReceipt::class)->data($order->fresh(), $order->invoice()->first());

        $this->assertSame('Card / online (VISA-Dutch Bangla)', $data['payment']['method']);
        $this->assertSame('BANKTX123', $data['payment']['reference']);
    }

    public function test_it_is_drawn_once_and_the_same_document_is_sent_every_time(): void
    {
        $order = $this->paidOrder();
        $receipts = app(MoneyReceipt::class);

        $first = $receipts->ensureFor($order);
        Storage::disk('private')->put($first->document_path, '%PDF-kept');

        $second = $receipts->ensureFor($order->fresh());

        $this->assertSame($first->document_path, $second->document_path);
        $this->assertSame('%PDF-kept', Storage::disk('private')->get($second->document_path));
    }

    public function test_the_student_downloads_it_from_their_account(): void
    {
        $student = $this->customer();
        $order = $this->paidOrder($student);

        $response = $this->actingAs($student)
            ->get('/api/v1/account/orders/'.$order->number.'/receipt')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        $this->assertStringContainsString('Money-receipt-INV-260921-AB12CD.pdf', (string) $response->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('%PDF', $response->streamedContent());
    }

    public function test_nobody_else_downloads_it_and_an_unpaid_order_has_none(): void
    {
        $order = $this->paidOrder();

        $this->actingAs($this->customer())
            ->getJson('/api/v1/account/orders/'.$order->number.'/receipt')
            ->assertForbidden();

        $unpaid = Order::factory()->for($student = $this->customer())->create();
        $this->actingAs($student)
            ->getJson('/api/v1/account/orders/'.$unpaid->number.'/receipt')
            ->assertNotFound();
    }

    /** On its own: an earlier actingAs() in the same test would stay signed in. */
    public function test_a_signed_out_visitor_gets_nothing(): void
    {
        $order = $this->paidOrder();

        $this->getJson('/api/v1/account/orders/'.$order->number.'/receipt')->assertUnauthorized();
    }

    public function test_the_email_still_goes_when_the_receipt_cannot_be_drawn(): void
    {
        $order = $this->paidOrder();
        $this->mock(MoneyReceipt::class, fn ($mock) => $mock->shouldReceive('ensureFor')->andThrow(new RuntimeException('no fonts')));

        (new SendOrderReceipt($order->getKey()))->handle();

        Mail::assertSent(OrderReceiptMail::class, fn (OrderReceiptMail $mail) => $mail->attachments() === []);
    }
}
