<?php

namespace App\Services\Payments;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Jobs\FulfillOrder;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Commerce\OrderStateMachine;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

class ManualPaymentReview
{
    public function review(User $admin, int $id, array $data): array
    {
        abort_unless($admin->hasRole('admin', 'super_admin') && $admin->isActive() && $admin->hasVerifiedEmail() && $admin->hasPermission('orders.manage'), 403);
        $data = validator($data, ['decision' => ['required', 'in:approved,rejected'], 'note' => ['required', 'string', 'min:3', 'max:500'], 'confirmed_amount_minor' => ['required_if:decision,approved', 'integer', 'min:1']])->validate();
        $entry = DB::table('manual_payment_submissions')->where('id', $id)->first();
        abort_unless($entry, 404);

        return DB::transaction(function () use ($admin, $entry, $data) {
            $order = Order::whereKey($entry->order_id)->lockForUpdate()->firstOrFail();
            $row = DB::table('manual_payment_submissions')->where('id', $entry->id)->lockForUpdate()->first();
            $payment = Payment::whereKey($row->payment_id)->lockForUpdate()->firstOrFail();
            abort_unless($payment->gateway === 'manual' && $payment->order_id === $order->id, 409);
            if ($data['decision'] === 'approved') {
                abort_unless((int) $data['confirmed_amount_minor'] === $order->total_minor && $payment->amount_minor === $order->total_minor && $payment->currency === $order->currency, 422, 'The received amount must equal the order total.');
            }
            if ($row->status === $data['decision']) {
                return ['decision' => $row->status, 'wallet_credit' => app(ManualWalletCredit::class)->receipt($payment)];
            }
            abort_unless($row->status === 'pending', 409, 'This submission has already been reviewed.');
            abort_unless($order->status === OrderStatus::PendingPayment, 409, 'Order is no longer awaiting payment.');
            $credit = null;
            if ($data['decision'] === 'approved') {
                $payment->update(['status' => PaymentStatus::Validated, 'settled_amount_minor' => $order->total_minor, 'validated_at' => now(), 'bank_transaction_id' => $row->transaction_id]);
                $credit = app(ManualWalletCredit::class)->credit($order, $payment, $admin, $data['note']);
                app(OrderStateMachine::class)->transition($order, OrderStatus::Paid, 'Manual payment verified; submission #'.$row->id, $admin);
                FulfillOrder::dispatch($order->id)->afterCommit();
            } else {
                $payment->update(['status' => PaymentStatus::Failed, 'failed_at' => now()]);
            }
            DB::table('manual_payment_submissions')->where('id', $row->id)->update(['status' => $data['decision'], 'reviewer_id' => $admin->id, 'review_note' => $data['note'], 'reviewed_at' => now(), 'updated_at' => now()]);
            Audit::record('payment.manual_'.$data['decision'], $payment, ['submission_id' => $row->id, 'note' => $data['note']], $admin->id);

            return ['decision' => $data['decision'], 'wallet_credit' => $credit];
        }, 5);
    }
}
