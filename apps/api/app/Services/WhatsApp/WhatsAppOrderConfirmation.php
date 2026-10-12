<?php

namespace App\Services\WhatsApp;

use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class WhatsAppOrderConfirmation
{
    public const TEMPLATE = 'nb_order_confirmation_v1';

    public function queue(Order $order): void
    {
        if (! in_array($order->status, [OrderStatus::Paid, OrderStatus::Fulfilled], true)) {
            return;
        }
        try {
            DB::table('wa_order_confirmations')->insertOrIgnore(['order_id' => $order->id, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        } catch (Throwable $error) {
            report($error);
        }
    }

    public function approved(): bool
    {
        return Cache::remember('wa-order-template-approved', 60, function () {
            $s = app(WhatsAppMessaging::class)->settings();
            if (! $s->enabled || ! $s->access_token) {
                return false;
            }
            try {
                $r = Http::withToken(Crypt::decryptString($s->access_token))->timeout(15)->get('https://graph.facebook.com/'.$s->api_version.'/'.$s->waba_id.'/message_templates', ['name' => self::TEMPLATE, 'fields' => 'name,status,language,category']);

                return $r->successful() && collect($r->json('data', []))->contains(fn ($t) => ($t['name'] ?? '') === self::TEMPLATE && ($t['status'] ?? '') === 'APPROVED' && ($t['category'] ?? '') === 'UTILITY' && ($t['language'] ?? '') === 'bn');
            } catch (Throwable) {
                return false;
            }
        });
    }

    public function process(int $max = 5): void
    {
        if (! $this->approved()) {
            return;
        }
        foreach (DB::table('wa_order_confirmations')->where('status', 'pending')->orderBy('id')->limit($max)->pluck('id') as $id) {
            $message = DB::transaction(function () use ($id) {
                $s = DB::table('wa_settings')->where('id', 1)->lockForUpdate()->firstOrFail();
                $request = DB::table('wa_order_confirmations')->where('id', $id)->lockForUpdate()->firstOrFail();
                if ($request->status !== 'pending') {
                    return null;
                }
                $order = Order::with('items')->find($request->order_id);
                if (! $order || ! in_array($order->status, [OrderStatus::Paid, OrderStatus::Fulfilled], true)) {
                    DB::table('wa_order_confirmations')->where('id', $id)->update(['status' => 'skipped', 'reason' => 'Order no longer paid', 'updated_at' => now()]);

                    return null;
                }
                $wa = app(WhatsAppMessaging::class);
                try {
                    $phone = $wa->phone((string) $order->billing_phone);
                } catch (Throwable) {
                    DB::table('wa_order_confirmations')->where('id', $id)->update(['status' => 'skipped', 'reason' => 'Valid Bangladesh WhatsApp number required', 'updated_at' => now()]);

                    return null;
                }
                $contact = DB::table('wa_contacts')->where('phone', $phone)->lockForUpdate()->first();
                $consented = in_array('whatsapp_confirmation', $order->accepted_terms ?? [], true) || ($contact && $contact->opt_in);
                if (! $consented || ($contact && ($contact->opt_out || $contact->suppressed))) {
                    DB::table('wa_order_confirmations')->where('id', $id)->update(['status' => 'skipped', 'reason' => 'No consent, opted out or suppressed', 'updated_at' => now()]);

                    return null;
                }
                if (! $s->enabled || $wa->quota($s) < 1) {
                    return null;
                }
                if (! $contact) {
                    $contactId = DB::table('wa_contacts')->insertGetId(['phone' => $phone, 'name' => $order->billing_name, 'created_at' => now(), 'updated_at' => now()]);
                } else {
                    $contactId = $contact->id;
                }
                $items = Str::limit($order->items->pluck('product_name')->join(', '), 400, '…');
                $params = [Str::limit($order->billing_name ?: 'গ্রাহক', 120), $order->number, $items ?: 'আপনার অর্ডার', $order->currency.' '.number_format($order->total_minor / 100, 2, '.', '')];
                $messageId = DB::table('wa_messages')->insertGetId(['contact_id' => $contactId, 'client_key' => (string) Str::uuid(), 'direction' => 'outbound', 'kind' => 'template', 'template' => self::TEMPLATE, 'template_params' => json_encode($params, JSON_UNESCAPED_UNICODE), 'body' => 'পেমেন্ট নিশ্চিত হয়েছে। অর্ডার: '.$order->number.' · '.$items.' · '.$params[3], 'mode' => 'confirmation', 'status' => 'queued', 'occurred_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
                DB::table('wa_order_confirmations')->where('id', $id)->update(['message_id' => $messageId, 'status' => 'reserved', 'updated_at' => now()]);

                return $messageId;
            });
            if ($message) {
                app(WhatsAppMessaging::class)->dispatch($message);
            }
        }
    }

    public function eligibleMessage(object $message, object $contact): bool
    {
        $request = DB::table('wa_order_confirmations')->where('message_id', $message->id)->first();
        $order = $request ? Order::find($request->order_id) : null;
        if (! $order || ! in_array($order->status, [OrderStatus::Paid, OrderStatus::Fulfilled], true)) {
            return false;
        }
        try {
            $phone = app(WhatsAppMessaging::class)->phone((string) $order->billing_phone);
        } catch (Throwable) {
            return false;
        }

        return $phone === $contact->phone && (in_array('whatsapp_confirmation',$order->accepted_terms ?? [],true) || $contact->opt_in);
    }
}
