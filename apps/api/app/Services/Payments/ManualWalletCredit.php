<?php

namespace App\Services\Payments;

use App\Models\Order;
use App\Models\Payment;
use App\Models\SoftwareLicense;
use App\Models\User;
use App\Services\Licensing\OnlineLicensingService;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ManualWalletCredit
{
    /** Called only inside the locked payment approval transaction. */
    public function credit(Order $order, Payment $payment, User $admin, string $reason): array
    {
        abort_unless(DB::transactionLevel() > 0 && $payment->gateway === 'manual' && $payment->status->value === 'validated' && $payment->order_id === $order->id, 409);
        if ($payment->wallet_credit_result !== null) {
            return $this->receipt($payment, true);
        }
        $items = $order->items()->where('product_type', 'credit_refill')->get();
        $result = ['eligible' => false, 'already_credited' => false, 'amount' => 0, 'transaction_id' => null];
        if ($items->isNotEmpty()) {
            $targets = $items->map(fn ($item) => $item->fulfillment_meta['wallet_license_code'] ?? null)->filter()->unique();
            abort_if($targets->count() > 1, 409, 'Order has conflicting wallet targets.');
            if ($targets->isNotEmpty()) {
                $target = SoftwareLicense::where('user_id', $order->user_id)->where('license_code', $targets->first())->first();
                abort_unless($target && DB::table('nb_online_wallets')->where('software_license_id', $target->id)->exists()
                    && DB::table('refill_orders')->where('order_id', $order->id)->where('software_license_id', $target->id)->exists(), 409, 'The selected wallet is unavailable; reconcile before approval.');
            }
            $assigned = DB::table('refill_orders')->where('order_id', $order->id)->whereNotNull('software_license_id')->distinct()->pluck('software_license_id');
            abort_if($assigned->count() > 1, 409, 'Refill has multiple target licenses; reconcile before approval.');
            $walletLicenses = DB::table('nb_online_wallets')->join('software_licenses', 'software_licenses.id', '=', 'nb_online_wallets.software_license_id')->where('software_licenses.user_id', $order->user_id)->pluck('software_licenses.id');
            if ($assigned->isNotEmpty()) {
                $assignedLicense = SoftwareLicense::findOrFail($assigned->first());
                abort_unless($assignedLicense->user_id === $order->user_id, 409, 'Refill license belongs to another user.');
                abort_if($walletLicenses->isNotEmpty() && ! $walletLicenses->contains($assignedLicense->id), 409, 'Assigned license is not a managed wallet.');
                $walletLicenses = $walletLicenses->filter(fn ($id) => $id === $assignedLicense->id);
            }
            abort_if($walletLicenses->count() > 1, 409, 'Assign the refill to one existing license before approval.');
            if ($walletLicenses->isNotEmpty()) {
                $license = SoftwareLicense::whereKey($walletLicenses->first())->lockForUpdate()->firstOrFail();
                app(OnlineLicensingService::class)->usable($license);
                abort_unless($license->user && $license->user->isActive() && $license->user->hasVerifiedEmail(), 409, 'Wallet owner is not active and verified.');
                $wallet = DB::table('nb_online_wallets')->where('software_license_id', $license->id)->lockForUpdate()->first();
                abort_unless($wallet && $wallet->status === 'active', 409, 'Wallet is not active.');
                abort_if($order->created_at->lt($wallet->created_at), 409, 'Older purchases require opening-balance reconciliation.');
                abort_if(DB::table('nb_token_issues')->where('order_id', $order->id)->exists() || DB::table('refill_orders')->where('order_id', $order->id)->where('status', 'issued')->exists() || DB::table('nb_wallet_entries')->where('order_id', $order->id)->exists(), 409, 'This order already has issued credit; reconcile before approval.');
                $amount = 0;
                foreach ($items as $item) {
                    $tokens = $item->fulfillment_meta['credit_amount'] ?? null;
                    abort_unless(is_int($tokens) && $tokens > 0 && $tokens <= 1000000 && $item->quantity >= 1 && $item->quantity <= 1000000, 422, 'Invalid token quantity in order snapshot.');
                    $amount += $tokens * $item->quantity;
                }
                abort_unless($amount > 0 && $amount <= 1000000 && $wallet->balance + $amount <= 2147483647, 422, 'Wallet credit limit exceeded.');
                $transaction = (string) Str::uuid();
                $result = ['eligible' => true, 'already_credited' => false, 'amount' => $amount, 'transaction_id' => $transaction, 'license_id' => $license->id];
                DB::table('nb_wallet_entries')->insert([
                    'software_license_id' => $license->id, 'transaction_id' => $transaction, 'reference' => 'manual-wallet:order:'.$order->id,
                    'order_id' => $order->id, 'payment_id' => $payment->id, 'user_id' => $order->user_id,
                    'delta' => $amount, 'balance' => $wallet->balance + $amount, 'source' => 'manual_payment', 'action_type' => 'payment_credit',
                    'created_by' => $admin->id, 'reason' => $reason, 'reference_note' => $payment->reference,
                    'wallet_version' => $wallet->version + 1, 'created_at' => now(),
                ]);
                DB::table('nb_online_wallets')->where('software_license_id', $license->id)->update(['balance' => $wallet->balance + $amount, 'version' => $wallet->version + 1, 'updated_at' => now()]);
                Audit::record('wallet.payment_credited', $payment, ['transaction_id' => $transaction, 'license_id' => $license->id, 'user_id' => $order->user_id, 'amount' => $amount, 'reason' => $reason], $admin->id);
            }
        }
        $payment->wallet_credit_result = $result;
        $payment->save();

        return $result;
    }

    public function receipt(Payment $payment, bool $replay = true): array
    {
        $result = $payment->wallet_credit_result ?? ['eligible' => false, 'amount' => 0, 'transaction_id' => null];
        if ($result['eligible']) {
            $entry = DB::table('nb_wallet_entries')->where('payment_id', $payment->id)->first();
            abort_unless($entry && $entry->transaction_id === $result['transaction_id'] && (int) $entry->delta === $result['amount'] && (int) $entry->software_license_id === $result['license_id'], 409, 'Payment credit audit is inconsistent; reconciliation required.');
        }

        return [...$result, 'already_credited' => $result['eligible'] && $replay];
    }
}
