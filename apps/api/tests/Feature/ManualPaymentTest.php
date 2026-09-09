<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\Role;
use App\Jobs\FulfillOrder;
use App\Models\Course;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Services\Fulfillment\FulfillmentService;
use App\Services\Payments\PaymentProcessor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Testing\File;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ManualPaymentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
    }

    private function receipt(): File
    {
        return UploadedFile::fake()->createWithContent('receipt.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='));
    }

    private function pending(): Order
    {
        Setting::updateOrCreate(['key' => 'payments.manual_methods'], ['value' => [['id' => 'bkash', 'enabled' => true, 'recipient' => 'TEST-MERCHANT', 'instructions' => 'Payment']], 'group' => 'payments']);
        $order = Order::factory()->create(['user_id' => $this->customer()->id]);
        $this->actingAs($order->user);

        return $order;
    }

    private function submit(Order $order, string $transaction = 'TEST12345'): int
    {
        $this->postJson('/api/v1/checkout/orders/'.$order->number.'/payment/manual', ['method' => 'bkash', 'sender' => 'TEST-SENDER', 'transaction_id' => $transaction, 'proof' => $this->receipt()])->assertOk();

        return DB::table('manual_payment_submissions')->where('order_id', $order->id)->latest('id')->value('id');
    }

    public function test_access_is_granted_only_after_verified_approval_and_not_twice(): void
    {
        Bus::fake();
        $order = $this->pending();
        $course = Course::factory()->published()->create();
        $product = Product::factory()->create(['type' => 'course']);
        $variant = ProductVariant::factory()->create(['product_id' => $product->id, 'course_id' => $course->id]);
        $order->items()->create(['product_variant_id' => $variant->id, 'product_type' => 'course', 'product_name' => 'Course', 'variant_name' => 'Access', 'sku' => $variant->sku, 'quantity' => 1, 'unit_price_minor' => $order->total_minor, 'line_total_minor' => $order->total_minor, 'fulfillment_meta' => ['course_id' => $course->id]]);
        $software = ProductVariant::factory()->create(['product_id' => Product::factory()->create(['type' => 'software_license'])->id]);
        $order->items()->create(['product_variant_id' => $software->id, 'product_type' => 'software_license', 'product_name' => 'Software', 'variant_name' => 'Single device', 'sku' => $software->sku, 'quantity' => 1, 'unit_price_minor' => $order->total_minor, 'line_total_minor' => $order->total_minor, 'fulfillment_meta' => ['device_limit' => 1]]);
        $order->update(['total_minor' => $order->total_minor * 2, 'subtotal_minor' => $order->subtotal_minor * 2]);
        $id = $this->submit($order);
        app(FulfillmentService::class)->fulfill($order->fresh());
        $this->assertDatabaseCount('enrollments', 0);
        $this->assertDatabaseCount('software_licenses', 0);
        Bus::assertNotDispatched(FulfillOrder::class);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->postJson('/api/v1/admin/manual-payments/'.$id.'/review', ['decision' => 'approved', 'note' => 'Statement checked', 'confirmed_amount_minor' => 1])->assertUnprocessable();
        $this->postJson('/api/v1/admin/orders/'.$order->number.'/transition', ['status' => 'paid', 'reason' => 'Bypass'])->assertUnprocessable();
        $payload = ['decision' => 'approved', 'note' => 'Statement checked', 'confirmed_amount_minor' => $order->total_minor];
        $this->postJson('/api/v1/admin/manual-payments/'.$id.'/review', $payload)->assertOk();
        $this->postJson('/api/v1/admin/manual-payments/'.$id.'/review', $payload)->assertOk();
        Bus::assertDispatchedTimes(FulfillOrder::class, 1);
        $this->assertSame(OrderStatus::Paid, $order->fresh()->status);
        app(FulfillmentService::class)->fulfill($order->fresh());
        app(FulfillmentService::class)->fulfill($order->fresh());
        $this->assertDatabaseHas('enrollments', ['user_id' => $order->user_id, 'course_id' => $course->id]);
        $this->assertDatabaseCount('enrollments', 1);
        $this->assertDatabaseCount('software_licenses', 1);
    }

    public function test_ownership_permissions_and_duplicate_transactions_are_enforced(): void
    {
        $order = $this->pending();
        $id = $this->submit($order);
        $this->postJson('/api/v1/admin/manual-payments/'.$id.'/review', ['decision' => 'approved'])->assertForbidden();
        $this->getJson('/api/v1/admin/manual-payments')->assertForbidden();
        $other = $this->customer();
        $this->actingAs($other)->getJson('/api/v1/checkout/orders/'.$order->number.'/payment')->assertNotFound();
        $another = Order::factory()->create(['user_id' => $other->id]);
        $this->postJson('/api/v1/checkout/orders/'.$another->number.'/payment/manual', ['method' => 'bkash', 'sender' => 'TEST-SENDER', 'transaction_id' => 'test12345', 'proof' => $this->receipt()])->assertUnprocessable();
        $this->assertDatabaseCount('manual_payment_submissions', 1);
    }

    public function test_rejection_retains_history_and_allows_new_submission_without_access(): void
    {
        Bus::fake();
        $order = $this->pending();
        $id = $this->submit($order);
        $this->actingAs($this->userWithRole(Role::SuperAdmin))->postJson('/api/v1/admin/manual-payments/'.$id.'/review', ['decision' => 'rejected', 'note' => 'Transaction not found'])->assertOk();
        $this->getJson('/api/v1/admin/manual-payments/pending-count')->assertOk()->assertJsonPath('data.pending_count', 0);
        $this->assertSame(OrderStatus::PendingPayment, $order->fresh()->status);
        $this->actingAs($order->user);
        $this->submit($order, 'NEW12345');
        $this->getJson('/api/v1/admin/manual-payments/pending-count')->assertForbidden();
        $this->actingAs($this->userWithRole(Role::SuperAdmin))->getJson('/api/v1/admin/manual-payments/pending-count')->assertOk()->assertJsonPath('data.pending_count', 1);
        $this->assertDatabaseCount('manual_payment_submissions', 2);
        Bus::assertNotDispatched(FulfillOrder::class);
    }

    public function test_gateway_callback_cannot_approve_manual_payment(): void
    {
        Bus::fake();
        $order = $this->pending();
        $this->submit($order);
        $payment = Payment::firstOrFail();
        $event = app(PaymentProcessor::class)->handleCallback('ipn', ['tran_id' => $payment->reference, 'status' => 'VALID', 'val_id' => 'TEST', 'amount' => $order->total_minor / 100, 'currency' => 'BDT']);
        $this->assertFalse($event->is_valid);
        $this->assertSame(OrderStatus::PendingPayment, $order->fresh()->status);
        Bus::assertNotDispatched(FulfillOrder::class);
    }

    public function test_methods_are_selectable_without_a_recipient_but_proof_is_required(): void
    {
        $order = $this->pending();
        Setting::where('key', 'payments.manual_methods')->delete();
        $this->getJson('/api/v1/checkout/orders/'.$order->number.'/payment')->assertOk()->assertJsonPath('data.methods.0.enabled', true)->assertJsonPath('data.methods.3.enabled', true)->assertJsonPath('data.gateway_enabled', false);
        $this->postJson('/api/v1/checkout/orders/'.$order->number.'/payment/manual', ['method' => 'bkash', 'sender' => 'TEST', 'transaction_id' => 'TEST1234'])->assertUnprocessable();
        $this->postJson('/api/v1/checkout/orders/'.$order->number.'/payment/gateway')->assertUnprocessable();
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_admin_can_configure_receiving_accounts(): void
    {
        $methods = array_map(fn ($id) => ['id' => $id, 'enabled' => $id === 'bkash', 'recipient' => $id === 'bkash' ? 'TEST-MERCHANT' : '', 'instructions' => ''], ['bkash', 'nagad', 'rocket', 'bank']);
        $this->actingAs($this->customer())->putJson('/api/v1/admin/payment-methods', ['methods' => $methods])->assertForbidden();
        $this->actingAs($this->userWithRole(Role::SuperAdmin))->putJson('/api/v1/admin/payment-methods', ['methods' => $methods])->assertOk()->assertJsonPath('data.0.enabled', true);
        $methods[0]['recipient'] = '';
        $this->putJson('/api/v1/admin/payment-methods', ['methods' => $methods])->assertOk();
    }

    public function test_pending_manual_review_blocks_online_payment_and_other_users_cannot_start_it(): void
    {
        config(['sslcommerz.driver' => 'sslcommerz', 'sslcommerz.mode' => 'sandbox', 'sslcommerz.sandbox.store_id' => 'test', 'sslcommerz.sandbox.store_password' => 'test']);
        $order = $this->pending();
        $this->getJson('/api/v1/checkout/orders/'.$order->number.'/payment')->assertOk()->assertJsonPath('data.gateway_enabled', false);
        $this->submit($order);
        $this->postJson('/api/v1/checkout/orders/'.$order->number.'/payment/gateway')->assertUnprocessable();
        $this->actingAs($this->customer())->postJson('/api/v1/checkout/orders/'.$order->number.'/payment/gateway')->assertUnprocessable();
    }

    public function test_proof_is_private_and_only_authorized_reviewers_can_view_it(): void
    {
        $order = $this->pending();
        $id = $this->submit($order);
        $path = DB::table('manual_payment_submissions')->where('id', $id)->value('proof_path');
        Storage::disk('private')->assertExists($path);
        $url = '/api/v1/admin/manual-payments/'.$id.'/proof';
        $this->getJson($url)->assertForbidden();
        $this->actingAs($this->customer())->getJson($url)->assertForbidden();
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->getJson('/api/v1/admin/manual-payments')->assertOk()->assertJsonPath('data.0.has_proof', true)->assertJsonMissingPath('data.0.proof_path');
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/png')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->actingAs($order->user);
        $this->postJson('/api/v1/checkout/orders/'.$order->number.'/payment/manual', ['method' => 'bkash', 'sender' => 'TEST', 'transaction_id' => 'SECOND123', 'proof' => $this->receipt()])->assertConflict();
        $this->assertCount(1, Storage::disk('private')->allFiles());
    }

    public function test_invalid_and_oversized_proof_are_rejected_and_all_methods_accept_images(): void
    {
        $order = $this->pending();
        $url = '/api/v1/checkout/orders/'.$order->number.'/payment/manual';
        $payload = ['method' => 'bkash', 'sender' => 'TEST', 'transaction_id' => 'RECEIPT123'];
        foreach ([UploadedFile::fake()->create('receipt.svg', 1, 'image/svg+xml'), $this->receipt()->size(5121)] as $file) {
            $this->postJson($url, $payload + ['proof' => $file])->assertUnprocessable();
        }
        $this->assertDatabaseCount('payments', 0);
        foreach (['bkash', 'nagad', 'rocket', 'bank'] as $method) {
            $next = Order::factory()->create(['user_id' => $order->user_id]);
            $this->postJson('/api/v1/checkout/orders/'.$next->number.'/payment/manual', ['method' => $method, 'sender' => 'TEST', 'transaction_id' => 'RECEIPT123', 'proof' => $this->receipt()])->assertOk();
        }
        $this->assertDatabaseCount('manual_payment_submissions', 4);
    }
}
