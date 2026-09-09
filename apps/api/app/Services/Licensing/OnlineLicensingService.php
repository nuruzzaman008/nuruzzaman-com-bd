<?php

namespace App\Services\Licensing;

use App\Models\Order;
use App\Models\SoftwareLicense;
use App\Models\User;
use App\Support\MachineIdentifier;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OnlineLicensingService
{
    public function pair(string $machine): array
    {
        abort_unless(config('online_licensing.enabled'), 503, 'Online licensing is not configured.');
        $secret = bin2hex(random_bytes(32));
        $code = bin2hex(random_bytes(24));
        DB::table('nb_devices')->insert([
            'secret_hash' => hash('sha256', $secret), 'pair_hash' => hash('sha256', $code),
            'machine_encrypted' => Crypt::encryptString(MachineIdentifier::normalize($machine)),
            'machine_hash' => MachineIdentifier::fingerprint($machine),
            'expires_at' => now()->addMinutes(10), 'created_at' => now(), 'updated_at' => now(),
        ]);

        return ['secret' => $secret, 'code' => $code];
    }

    public function usable(SoftwareLicense $license): void
    {
        abort_unless(DB::table('order_items')->where('id', $license->order_item_id)->whereIn('sku', config('online_licensing.license_skus'))->exists(), 403, 'This product is not enabled for NB online licensing.');
        abort_unless($license->status->isUsable() && ! $license->revoked_at && (! $license->expires_at || $license->expires_at->isFuture()) && $license->order->status->grantsEntitlements(), 403, 'License is not eligible.');
    }

    public function confirm(User $user, string $code, string $licenseCode): void
    {
        abort_unless(config('online_licensing.enabled'), 503);
        DB::transaction(function () use ($user, $code, $licenseCode) {
            $license = SoftwareLicense::where('license_code', $licenseCode)->where('user_id', $user->id)->lockForUpdate()->firstOrFail();
            $this->usable($license);
            $device = DB::table('nb_devices')->where('pair_hash', hash('sha256', $code))->lockForUpdate()->first();
            abort_unless($device && ! $device->confirmed_at && $device->expires_at > now(), 422, 'Pairing expired or already used.');
            $binding = $license->machineBindings()->where('machine_id_fingerprint', $device->machine_hash)->whereNull('released_at')->first();
            if (! $binding) {
                abort_if($license->machineBindings()->whereNull('released_at')->count() >= $license->device_limit, 409, 'Device limit reached.');
                $binding = $license->machineBindings()->make(['bound_at' => now(), 'label' => 'AutoCAD online connector']);
                $binding->setMachineId(Crypt::decryptString($device->machine_encrypted));
                $binding->save();
            }
            DB::table('nb_devices')->where('id', $device->id)->update(['software_license_id' => $license->id, 'confirmed_at' => now(), 'updated_at' => now()]);
            // Reconnecting the same machine must never mint another activation grant.
            $device->software_license_id = $license->id;
            $this->issue($license, $device, $license->order, 'activation:'.$license->id.':'.$device->machine_hash, 'ACTIVATION', 50);
            DB::table('nb_token_issues')->where('software_license_id', $license->id)->whereIn('nb_device_id', DB::table('nb_devices')->where('software_license_id', $license->id)->where('machine_hash', $device->machine_hash)->select('id'))->update(['nb_device_id' => $device->id]);
        });
        foreach (Order::where('user_id', $user->id)->whereIn('id', DB::table('refill_orders')->where('user_id', $user->id)->where('status', 'requested')->select('order_id'))->get() as $order) {
            $this->autoRefill($order);
        }
    }

    public function refill(Order $order, SoftwareLicense $license): void
    {
        abort_unless($order->user_id === $license->user_id && $order->status->grantsEntitlements(), 403);
        $this->usable($license);
        DB::transaction(function () use ($order, $license) {
            Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            abort_if(DB::table('refill_orders')->where('order_id', $order->id)->where('status', 'issued')->exists() && ! DB::table('nb_token_issues')->where('order_id', $order->id)->exists(), 409, 'This refill was already issued offline.');
            $devices = DB::table('nb_devices')->where('software_license_id', $license->id)->whereNotNull('confirmed_at')->orderByDesc('id')->get()->unique('machine_hash');
            abort_unless($devices->count() === 1, 409, 'Connect exactly one machine before purchasing automatic refills.');
            foreach ($order->items as $item) {
                if ($item->product_type !== 'credit_refill') {
                    continue;
                }
                $amount = (int) ($item->fulfillment_meta['credit_amount'] ?? 0) * $item->quantity;
                $existing = DB::table('nb_token_issues')->where('entitlement', 'refill:item:'.$item->id)->first();
                abort_if($existing && $existing->software_license_id !== $license->id, 409, 'This refill is already assigned to another license.');
                abort_unless($amount >= 1 && $amount <= 1000000, 422, 'Invalid refill quantity.');
                $this->issue($license, $devices->first(), $order, 'refill:item:'.$item->id, 'TOKEN_REFILL', $amount);
            }
            DB::table('refill_orders')->where('order_id', $order->id)->where('status', 'requested')->update(['status' => 'approved', 'software_license_id' => $license->id]);
        });
    }

    public function autoRefill(Order $order): void
    {
        if (! config('online_licensing.enabled') || ! $order->status->grantsEntitlements() || ! $order->items->contains('product_type', 'credit_refill')) {
            return;
        }
        $licenses = SoftwareLicense::where('user_id', $order->user_id)->whereIn('id', DB::table('nb_devices')->whereNotNull('confirmed_at')->select('software_license_id'))->whereIn('status', ['issued', 'active'])->get();
        if ($licenses->count() === 1) {
            $license = $licenses->first();
            if ($license->revoked_at || ($license->expires_at && $license->expires_at->isPast()) || ! $license->order->status->grantsEntitlements()) {
                return;
            }
            if (DB::table('nb_devices')->where('software_license_id', $license->id)->whereNotNull('confirmed_at')->distinct()->count('machine_hash') !== 1) {
                return;
            }
            $this->refill($order, $license);
        }
    }

    private function issue(SoftwareLicense $license, object $device, Order $order, string $entitlement, string $type, int $tokens): void
    {
        $payload = ['v' => 2, 'type' => $type, 'mid' => Crypt::decryptString($device->machine_encrypted), 'lic' => $license->license_code,
            'customer' => $license->user->name, 'tokens' => $tokens, 'rid' => $type === 'TOKEN_REFILL' ? 'R-'.Str::uuid() : '',
            'issued' => now()->utc()->format('Y-m-d\TH:i:s\Z'), 'nonce' => bin2hex(random_bytes(16))];
        DB::table('nb_token_issues')->insertOrIgnore(['entitlement' => $entitlement, 'software_license_id' => $license->id, 'nb_device_id' => $device->id, 'order_id' => $order->id,
            'payload_encrypted' => Crypt::encryptString(json_encode($payload, JSON_THROW_ON_ERROR)), 'created_at' => now(), 'updated_at' => now()]);
    }
}
