<?php

namespace App\Http\Controllers\Api\V1\Commerce;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Jobs\FulfillOrder;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Setting;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Payments\PaymentProcessor;
use App\Support\Audit;
use App\Support\Reference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PaymentSelectionController extends Controller
{
    private const METHODS = ['bkash', 'nagad', 'rocket', 'bank'];

    private function methods(): array
    {
        $saved = Setting::value('payments.manual_methods', []);

        return array_map(function ($id) use ($saved) {
            $row = collect(is_array($saved) ? $saved : [])->firstWhere('id', $id) ?? [];

            return ['id' => $id, 'name' => ['bkash' => 'bKash', 'nagad' => 'Nagad', 'rocket' => 'Rocket', 'bank' => 'Bank transfer'][$id], 'enabled' => (bool) ($row['enabled'] ?? true), 'recipient' => (string) ($row['recipient'] ?? ''), 'instructions' => (string) ($row['instructions'] ?? '')];
        }, self::METHODS);
    }

    private function gatewayEnabled(): bool
    {
        // New purchases use the owner's manually verified payment workflow.
        return false;
    }

    private function owned(Request $request, string $number): Order
    {
        return Order::where('number', $number)->where('user_id', $request->user()->id)->firstOrFail();
    }

    public function show(Request $request, string $number): JsonResponse
    {
        $order = $this->owned($request, $number);

        return response()->json(['data' => [
            'order' => (new OrderResource($order->load('items')))->resolve($request),
            'methods' => $this->methods(),
            'gateway_enabled' => $this->gatewayEnabled(),
            'gateway_test_mode' => config('sslcommerz.mode') !== 'live',
            'submissions' => DB::table('manual_payment_submissions')->where('order_id', $order->id)->orderByDesc('id')->get(['id', 'method', 'transaction_id', 'status', 'review_note', 'created_at']),
        ]]);
    }

    public function gateway(Request $request, string $number, PaymentProcessor $processor): JsonResponse
    {
        abort_unless($this->gatewayEnabled(), 422, 'Online card payment is not configured yet.');
        $order = $this->owned($request, $number);
        $session = DB::transaction(function () use ($order, $processor) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            abort_if(DB::table('manual_payment_submissions')->where('order_id', $order->id)->where('status', 'pending')->exists(), 409, 'A submitted payment is awaiting review.');

            return $processor->startPayment($locked);
        });

        return response()->json(['data' => ['redirect_url' => $session['redirect_url']]]);
    }

    public function submit(Request $request, string $number): JsonResponse
    {
        $order = $this->owned($request, $number);
        $request->merge(['transaction_id' => strtoupper(trim((string) $request->input('transaction_id')))]);
        $data = $request->validate([
            'method' => ['required', Rule::in(self::METHODS)],
            'transaction_id' => ['required', 'string', 'min:4', 'max:100', 'regex:/^[A-Z0-9-]+$/', Rule::unique('manual_payment_submissions')->where('method', $request->input('method'))],
            'sender' => ['required', 'string', 'min:4', 'max:100'],
            'proof' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);
        $method = collect($this->methods())->firstWhere('id', $data['method']);
        abort_unless($method['enabled'], 422, 'This payment method is not available yet.');
        $proofPath = $request->file('proof')->store('payment-proofs', 'private');
        try {
            DB::transaction(function () use ($order, $data, $method, $proofPath) {
                $locked = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
                abort_unless($locked->status === OrderStatus::PendingPayment, 409, 'Order is not awaiting payment.');
                abort_if(DB::table('manual_payment_submissions')->where('order_id', $order->id)->where('status', 'pending')->exists(), 409, 'Payment already awaits review.');
                abort_if($order->payments()->where('gateway', '!=', 'manual')->whereIn('status', ['initiated', 'pending', 'validated', 'risk_hold'])->exists(), 409, 'An online payment is in progress. Contact support before paying again.');
                $payment = Payment::create(['order_id' => $order->id, 'gateway' => 'manual', 'reference' => Reference::payment(), 'status' => PaymentStatus::Pending, 'currency' => $order->currency, 'amount_minor' => $order->total_minor]);
                DB::table('manual_payment_submissions')->insert(['order_id' => $order->id, 'payment_id' => $payment->id, 'method' => $data['method'], 'transaction_id' => $data['transaction_id'], 'sender' => $data['sender'], 'recipient' => $method['recipient'], 'proof_path' => $proofPath, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
                Audit::record('payment.manual_submitted', $payment, ['method' => $data['method']]);
            });

        } catch (\Throwable $exception) {
            Storage::disk('private')->delete($proofPath);
            throw $exception;
        }

        return $this->show($request, $number);
    }

    private function authorizeReviewer(Request $request): void
    {
        abort_unless($request->user()->hasRole('admin', 'super_admin') && $request->user()->hasPermission('orders.manage'), 403);
    }

    public function pendingCount(Request $request): JsonResponse
    {
        $this->authorizeReviewer($request);

        return response()->json(['data' => ['pending_count' => DB::table('manual_payment_submissions')->where('status', 'pending')->count()]])->header('Cache-Control', 'no-store');
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeReviewer($request);
        $status = $request->validate(['status' => ['sometimes', Rule::in(['pending', 'approved', 'rejected'])]])['status'] ?? 'pending';
        $rows = DB::table('manual_payment_submissions as s')->join('orders as o', 'o.id', '=', 's.order_id')->where('s.status', $status)->orderByDesc('s.id')->select(['s.*', 'o.number', 'o.total_minor', 'o.currency', 'o.billing_name', 'o.billing_email'])->paginate(25);

        $rows->through(function ($row) {
            $row->has_proof = filled($row->proof_path);
            unset($row->proof_path);

            return $row;
        });

        return response()->json($rows)->header('Cache-Control', 'no-store');
    }

    public function proof(Request $request, int $id): StreamedResponse
    {
        $this->authorizeReviewer($request);
        $row = DB::table('manual_payment_submissions')->where('id', $id)->first();
        abort_unless($row && filled($row->proof_path) && Storage::disk('private')->exists($row->proof_path), 404);

        return Storage::disk('private')->response($row->proof_path, null, [
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
        ]);
    }

    public function review(Request $request, int $id, OrderStateMachine $states): JsonResponse
    {
        $this->authorizeReviewer($request);
        $data = $request->validate(['decision' => ['required', Rule::in(['approved', 'rejected'])], 'note' => ['required', 'string', 'min:3', 'max:500'], 'confirmed_amount_minor' => ['required_if:decision,approved', 'integer', 'min:1']]);
        $entry = DB::table('manual_payment_submissions')->where('id', $id)->first();
        abort_unless($entry, 404);
        DB::transaction(function () use ($entry, $data, $request, $states) {
            $order = Order::whereKey($entry->order_id)->lockForUpdate()->firstOrFail();
            $row = DB::table('manual_payment_submissions')->where('id', $entry->id)->lockForUpdate()->first();
            if ($row->status === $data['decision']) {
                return;
            }
            abort_unless($row->status === 'pending', 409, 'This submission has already been reviewed.');
            abort_unless($order->status === OrderStatus::PendingPayment, 409, 'Order is no longer awaiting payment.');
            $payment = Payment::whereKey($row->payment_id)->lockForUpdate()->firstOrFail();
            if ($data['decision'] === 'approved') {
                abort_unless($data['confirmed_amount_minor'] === $order->total_minor && $payment->amount_minor === $order->total_minor && $payment->currency === $order->currency, 422, 'The received amount must equal the order total.');
                $payment->update(['status' => PaymentStatus::Validated, 'settled_amount_minor' => $order->total_minor, 'validated_at' => now(), 'bank_transaction_id' => $row->transaction_id]);
                $states->transition($order, OrderStatus::Paid, 'Manual payment verified; submission #'.$row->id, $request->user());
                FulfillOrder::dispatch($order->id)->afterCommit();
            } else {
                $payment->update(['status' => PaymentStatus::Failed, 'failed_at' => now()]);
            }
            DB::table('manual_payment_submissions')->where('id', $row->id)->update(['status' => $data['decision'], 'reviewer_id' => $request->user()->id, 'review_note' => $data['note'], 'reviewed_at' => now(), 'updated_at' => now()]);
            Audit::record('payment.manual_'.$data['decision'], $payment, ['submission_id' => $row->id, 'note' => $data['note']], $request->user()->id);
        });

        return response()->json(['message' => 'Payment review saved.']);
    }

    public function settings(Request $request): JsonResponse
    {
        $this->authorizeReviewer($request);
        abort_unless($request->user()->hasPermission('settings.manage'), 403);
        if ($request->isMethod('put')) {
            $data = $request->validate(['methods' => ['required', 'array', 'size:4'], 'methods.*.id' => ['required', 'distinct', Rule::in(self::METHODS)], 'methods.*.enabled' => ['required', 'boolean'], 'methods.*.recipient' => ['nullable', 'string', 'max:1000'], 'methods.*.instructions' => ['nullable', 'string', 'max:2000']]);
            Setting::updateOrCreate(['key' => 'payments.manual_methods'], ['group' => 'payments', 'value' => $data['methods'], 'is_public' => false]);
            Audit::record('payment.methods_updated');
        }

        return response()->json(['data' => $this->methods()]);
    }
}
