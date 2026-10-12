<?php

namespace App\Services\WhatsApp;

use Carbon\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class WhatsAppMessaging
{
    public const TEMPLATE = 'nbconsultant_intro_v1';

    public function settings(): object
    {
        return DB::table('wa_settings')->where('id', 1)->firstOrFail();
    }

    public function phone(string $value): string
    {
        $phone = preg_replace('/[ +()\-]/', '', trim($value));
        if (str_starts_with($phone, '00880')) {
            $phone = substr($phone, 2);
        }
        if (preg_match('/^01[3-9]\d{8}$/', $phone)) {
            $phone = '88'.$phone;
        }
        if (! preg_match('/^8801[3-9]\d{8}$/', $phone)) {
            throw ValidationException::withMessages(['phone' => 'Use a valid Bangladesh mobile number.']);
        }

        return $phone;
    }

    public function quota(object $settings): int
    {
        return max(0, min(50, $settings->daily_limit) - DB::table('wa_messages')->where('mode', 'campaign')->where(function ($q) {
            $q->whereNull('completed_at')->orWhere('completed_at', '>=', now()->subDay());
        })->count());
    }

    public function eligible(object $contact): bool
    {
        return (bool) $contact->opt_in && ! $contact->opt_out && ! $contact->suppressed
            && ! DB::table('wa_messages')->where('contact_id', $contact->id)->where('mode', 'campaign')->exists();
    }

    public function reserve(int $contactId, array $data, int $actorId): object
    {
        return DB::transaction(function () use ($contactId, $data, $actorId) {
            $settings = DB::table('wa_settings')->where('id', 1)->lockForUpdate()->firstOrFail();
            $existing = DB::table('wa_messages')->where('client_key', $data['client_key'])->first();
            if ($existing) {
                abort_unless($existing->contact_id === $contactId && $existing->actor_id === $actorId, 409, 'Request key already used.');

                return $existing;
            }
            if (! $settings->enabled || ! $settings->access_token) {
                throw ValidationException::withMessages(['connection' => 'Super admin must connect WhatsApp first.']);
            }
            $contact = DB::table('wa_contacts')->where('id', $contactId)->lockForUpdate()->firstOrFail();
            if ($contact->opt_out || $contact->suppressed) {
                throw ValidationException::withMessages(['contact' => 'This contact is opted out or suppressed.']);
            }
            $mode = $data['kind'] === 'template' ? (($data['test'] ?? false) ? 'test' : 'campaign') : 'reply';
            if ($mode === 'test' && $contact->phone !== '8801711945113') {
                throw ValidationException::withMessages(['contact' => 'Test mode sends only to 01711945113.']);
            }
            if ($data['kind'] === 'template' && ! $contact->opt_in) {
                throw ValidationException::withMessages(['contact' => 'Recorded opt-in is required for templates.']);
            }
            if ($mode === 'campaign' && (! $settings->campaign_enabled || ! $settings->test_received || ! $this->eligible($contact) || $this->quota($settings) < 1)) {
                throw ValidationException::withMessages(['campaign' => 'Campaign locked, contact already attempted, or rolling allowance exhausted.']);
            }
            if ($mode === 'reply' && (! $contact->last_inbound_at || Carbon::parse($contact->last_inbound_at)->lte(now()->subDay()))) {
                throw ValidationException::withMessages(['body' => 'The 24-hour reply window is closed. Send the approved template instead.']);
            }
            $id = DB::table('wa_messages')->insertGetId([
                'contact_id' => $contactId, 'actor_id' => $actorId, 'client_key' => $data['client_key'],
                'direction' => 'outbound', 'kind' => $data['kind'], 'body' => $data['body'] ?? null,
                'media_id' => $data['media_id'] ?? null, 'filename' => $data['filename'] ?? null,
                'template' => $data['kind'] === 'template' ? self::TEMPLATE : null, 'mode' => $mode,
                'status' => 'queued', 'occurred_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);

            return DB::table('wa_messages')->where('id', $id)->firstOrFail();
        });
    }

    public function dispatch(int $id): object
    {
        $message = DB::transaction(function () use ($id) {
            $message = DB::table('wa_messages')->where('id', $id)->lockForUpdate()->firstOrFail();
            if ($message->status !== 'queued') {
                return null;
            }
            $settings = $this->settings();
            if (! $settings->enabled || ($message->mode === 'campaign' && ! $settings->campaign_enabled)) {
                return null;
            }
            $contact = DB::table('wa_contacts')->where('id', $message->contact_id)->lockForUpdate()->firstOrFail();
            $windowClosed = $message->mode === 'reply' && (! $contact->last_inbound_at || Carbon::parse($contact->last_inbound_at)->lte(now()->subDay()));
            if ($contact->opt_out || $contact->suppressed || ($message->kind === 'template' && ! $contact->opt_in) || $windowClosed) {
                DB::table('wa_messages')->where('id', $id)->update(['status' => 'cancelled', 'completed_at' => now(), 'error_details' => 'Consent or reply window changed before dispatch.', 'updated_at' => now()]);

                return null;
            }
            DB::table('wa_messages')->where('id', $id)->update(['status' => 'sending', 'updated_at' => now()]);

            return $message;
        });
        if (! $message) {
            return DB::table('wa_messages')->where('id', $id)->firstOrFail();
        }
        $settings = $this->settings();
        $contact = DB::table('wa_contacts')->where('id', $message->contact_id)->firstOrFail();
        $payload = ['messaging_product' => 'whatsapp', 'to' => $contact->phone, 'type' => $message->kind];
        if ($message->kind === 'template') {
            $payload['template'] = ['name' => self::TEMPLATE, 'language' => ['code' => 'bn']];
        } elseif ($message->kind === 'text') {
            $payload['text'] = ['body' => $message->body, 'preview_url' => false];
        } else {
            $payload[$message->kind] = ['id' => $message->media_id];
            if ($message->kind === 'document' && $message->filename) {
                $payload['document']['filename'] = $message->filename;
            }
            if (in_array($message->kind, ['image', 'document', 'video']) && $message->body) {
                $payload[$message->kind]['caption'] = $message->body;
            }
        }
        try {
            $response = Http::withToken(Crypt::decryptString($settings->access_token))->timeout(25)->connectTimeout(10)
                ->post('https://graph.facebook.com/'.$settings->api_version.'/'.$settings->phone_number_id.'/messages', $payload);
            $waId = $response->json('messages.0.id');
            $accepted = $response->successful() && $waId;
            $update = ['status' => $accepted ? 'accepted' : 'uncertain', 'wa_id' => $waId, 'completed_at' => $accepted ? now() : null,
                'error_code' => $accepted ? null : (string) $response->json('error.code', 'API_FAILED'),
                'error_details' => $accepted ? null : 'Meta did not accept the request. Review error code; no automatic retry.'];
        } catch (Throwable) {
            $update = ['status' => 'uncertain', 'error_code' => 'NETWORK_UNKNOWN', 'error_details' => 'Send result unknown. Check Meta logs before resending.'];
        }
        DB::transaction(function () use ($id, $update, $contact) {
            DB::table('wa_settings')->where('id', 1)->lockForUpdate()->first();
            $current = DB::table('wa_messages')->where('id', $id)->lockForUpdate()->firstOrFail();
            if (! empty($update['wa_id'])) {
                $early = DB::table('wa_messages')->where('wa_id', $update['wa_id'])->where('id', '!=', $id)->lockForUpdate()->first();
                if ($early && $early->kind === 'external') {
                    $update['status'] = $early->status;
                    DB::table('wa_messages')->where('id', $early->id)->delete();
                }
            }
            $update['updated_at'] = now();
            if (in_array($current->status, ['sent', 'delivered', 'read', 'failed'])) {
                unset($update['status']);
            }
            DB::table('wa_messages')->where('id', $id)->update($update);
            DB::table('wa_contacts')->where('id', $contact->id)->update(['last_message_at' => now(), 'updated_at' => now()]);
        });

        return DB::table('wa_messages')->where('id', $id)->firstOrFail();
    }

    public function campaign(array $ids, int $actorId): array
    {
        return DB::transaction(function () use ($ids, $actorId) {
            $settings = DB::table('wa_settings')->where('id', 1)->lockForUpdate()->firstOrFail();
            if (! $settings->campaign_enabled || ! $settings->test_received || ! $settings->enabled || ! $settings->access_token) {
                throw ValidationException::withMessages(['campaign' => 'Connect WhatsApp and confirm the received test before enabling campaigns.']);
            }
            $remaining = $this->quota($settings);
            $out = [];
            foreach (DB::table('wa_contacts')->whereIn('id', $ids)->orderBy('id')->get() as $contact) {
                if (count($out) >= $remaining) {
                    break;
                }
                if ($contact->phone === '8801711945113' || ! $this->eligible($contact)) {
                    continue;
                }
                $out[] = $this->reserve($contact->id, ['kind' => 'template', 'client_key' => (string) Str::uuid()], $actorId)->id;
            }

            return $out;
        });
    }

    public function ingest(array $body): void
    {
        $settings = $this->settings();
        foreach ($body['entry'] ?? [] as $entry) {
            if ((string) ($entry['id'] ?? '') !== $settings->waba_id) {
                continue;
            }
            foreach ($entry['changes'] ?? [] as $change) {
                $value = $change['value'] ?? [];
                if ((string) ($value['metadata']['phone_number_id'] ?? '') !== $settings->phone_number_id) {
                    continue;
                }
                foreach ($value['messages'] ?? [] as $message) {
                    $this->receive($message, $value['contacts'][0]['profile']['name'] ?? null);
                }
                foreach ($value['statuses'] ?? [] as $status) {
                    $this->status($status);
                }
            }
        }
        DB::table('wa_settings')->where('id', 1)->update(['webhook_at' => now()]);
    }

    private function receive(array $message, ?string $name): void
    {
        if (empty($message['id']) || ! preg_match('/^8801[3-9]\d{8}$/', $message['from'] ?? '')) {
            return;
        }
        DB::transaction(function () use ($message, $name) {
            DB::table('wa_settings')->where('id', 1)->lockForUpdate()->first();
            if (DB::table('wa_messages')->where('wa_id', $message['id'])->exists()) {
                return;
            }
            DB::table('wa_contacts')->insertOrIgnore(['phone' => $message['from'], 'name' => $name, 'created_at' => now(), 'updated_at' => now()]);
            $contact = DB::table('wa_contacts')->where('phone', $message['from'])->lockForUpdate()->firstOrFail();
            $kind = $message['type'] ?? 'unknown';
            $details = $message[$kind] ?? [];
            $text = $details['body'] ?? $details['caption'] ?? $details['text'] ?? $details['button_reply']['title'] ?? $details['list_reply']['title'] ?? null;
            if ($text === null && in_array($kind, ['location', 'contacts', 'reaction'])) {
                $text = json_encode($details, JSON_UNESCAPED_UNICODE);
            }
            $occurred = Carbon::createFromTimestamp((int) ($message['timestamp'] ?? now()->timestamp))->utc();
            if ($occurred->gt(now()->addMinutes(5))) {
                $occurred = now();
            }
            DB::table('wa_messages')->insert(['contact_id' => $contact->id, 'wa_id' => $message['id'], 'direction' => 'inbound', 'kind' => $kind,
                'body' => $text, 'media_id' => $details['id'] ?? null, 'filename' => $details['filename'] ?? null, 'mime' => $details['mime_type'] ?? null,
                'status' => 'received', 'mode' => 'reply', 'occurred_at' => $occurred, 'created_at' => now(), 'updated_at' => now()]);
            $update = ['unread' => $contact->unread + 1, 'updated_at' => now()];
            if (! $contact->last_inbound_at || $occurred->gt(Carbon::parse($contact->last_inbound_at))) {
                $update['last_inbound_at'] = $occurred;
            }
            if (! $contact->last_message_at || $occurred->gt(Carbon::parse($contact->last_message_at))) {
                $update['last_message_at'] = $occurred;
            }
            if (in_array(mb_strtolower(trim((string) $text)), ['stop', 'unsubscribe', 'বন্ধ', 'বন্ধ করুন'])) {
                $update['opt_out'] = true;
            }
            DB::table('wa_contacts')->where('id', $contact->id)->update($update);
        });
    }

    private function status(array $event): void
    {
        if (empty($event['id']) || ! in_array($event['status'] ?? '', ['sent', 'delivered', 'read', 'failed'])) {
            return;
        }
        DB::transaction(function () use ($event) {
            DB::table('wa_settings')->where('id', 1)->lockForUpdate()->first();
            $time = Carbon::createFromTimestamp((int) ($event['timestamp'] ?? now()->timestamp))->utc();
            $fingerprint = hash('sha256', $event['id'].'|'.$event['status'].'|'.$time->timestamp);
            if (! DB::table('wa_status_events')->insertOrIgnore(['fingerprint' => $fingerprint, 'wa_id' => $event['id'], 'status' => $event['status'], 'occurred_at' => $time, 'created_at' => now()])) {
                return;
            }
            $message = DB::table('wa_messages')->where('wa_id', $event['id'])->lockForUpdate()->first();
            if (! $message && preg_match('/^8801[3-9]\d{8}$/', $event['recipient_id'] ?? '')) {
                DB::table('wa_contacts')->insertOrIgnore(['phone' => $event['recipient_id'], 'created_at' => now(), 'updated_at' => now()]);
                $contact = DB::table('wa_contacts')->where('phone', $event['recipient_id'])->firstOrFail();
                $id = DB::table('wa_messages')->insertGetId(['contact_id' => $contact->id, 'wa_id' => $event['id'], 'direction' => 'outbound', 'kind' => 'external', 'body' => 'Sent outside dashboard (for example n8n). Original body unavailable.', 'mode' => $contact->phone === '8801711945113' ? 'test' : 'campaign', 'status' => 'accepted', 'occurred_at' => $time, 'completed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
                $message = DB::table('wa_messages')->where('id', $id)->firstOrFail();
            }
            if (! $message) {
                return;
            }
            $rank = ['queued' => 0, 'sending' => 0, 'uncertain' => 0, 'accepted' => 1, 'sent' => 2, 'failed' => 2, 'delivered' => 3, 'read' => 4];
            if (($rank[$event['status']] ?? 0) < ($rank[$message->status] ?? 0)) {
                return;
            }
            DB::table('wa_messages')->where('id', $message->id)->update(['status' => $event['status'], 'completed_at' => $message->completed_at ?? now(), 'error_code' => isset($event['errors'][0]['code']) ? (string) $event['errors'][0]['code'] : null, 'error_details' => $event['status'] === 'failed' ? 'Meta reported delivery failure. Review the error code.' : null, 'updated_at' => now()]);
        });
    }
}
