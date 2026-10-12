<?php

namespace App\Services\WhatsApp;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class WhatsAppCalling
{
    public function http(): PendingRequest
    {
        $s = app(WhatsAppMessaging::class)->settings();
        abort_unless($s->access_token, 422, 'Connect WhatsApp first.');

        return Http::withToken(Crypt::decryptString($s->access_token))->timeout(20)->connectTimeout(10);
    }

    public function url(string $path): string
    {
        $s = app(WhatsAppMessaging::class)->settings();

        return 'https://graph.facebook.com/'.$s->api_version.'/'.$s->phone_number_id.'/'.$path;
    }

    public function permission(string $phone): array
    {
        $r = $this->http()->get($this->url('call_permissions'), ['user_wa_id' => $phone]);
        abort_unless($r->successful(), 422, 'Meta could not verify call permission. Code: '.$r->json('error.code', 'UNKNOWN'));

        return $r->json();
    }

    public function allowed(array $permission, string $action): bool
    {
        return collect($permission['actions'] ?? [])->contains(fn ($a) => ($a['action_name'] ?? '') === $action && ($a['can_perform_action'] ?? false) === true);
    }

    public function ingest(array $body): void
    {
        $s = app(WhatsAppMessaging::class)->settings();
        foreach ($body['entry'] ?? [] as $entry) {
            if ((string) ($entry['id'] ?? '') !== $s->waba_id) {
                continue;
            }
            foreach ($entry['changes'] ?? [] as $change) {
                $v = $change['value'] ?? [];
                if (($change['field'] ?? '') !== 'calls' || (string) ($v['metadata']['phone_number_id'] ?? '') !== $s->phone_number_id) {
                    continue;
                }
                DB::transaction(function () use ($v) {
                    DB::table('wa_settings')->where('id', 1)->lockForUpdate()->first();
                    foreach ($v['calls'] ?? [] as $c) {
                        if (empty($c['id'])) {
                            continue;
                        }
                        $existing = DB::table('wa_calls')->where('wa_id', $c['id'])->lockForUpdate()->first();
                        $out = ($c['direction'] ?? '') === 'BUSINESS_INITIATED' || ($c['session']['sdp_type'] ?? '') === 'answer';
                        $phone = $out ? ($c['to'] ?? '') : ($c['from'] ?? '');
                        if (! $existing) {
                            $key = $c['biz_opaque_callback_data'] ?? null;
                            if ($key) {
                                $existing = DB::table('wa_calls')->where('client_key', $key)->lockForUpdate()->first();
                            }
                        }
                        if (! $existing) {
                            if (! preg_match('/^\d{7,15}$/', $phone)) {
                                continue;
                            }
                            $id = DB::table('wa_calls')->insertGetId(['wa_id' => $c['id'], 'phone' => $phone, 'name' => $v['contacts'][0]['profile']['name'] ?? null, 'direction' => $out ? 'outbound' : 'inbound', 'status' => 'ringing', 'created_at' => now(), 'updated_at' => now()]);
                            $existing = DB::table('wa_calls')->where('id', $id)->first();
                        }
                        $u = ['wa_id' => $c['id'], 'updated_at' => now()];
                        if (($c['event'] ?? '') === 'terminate') {
                            $u += ['status' => strtolower(is_array($c['status'] ?? null) ? ($c['status'][0] ?? 'completed') : ($c['status'] ?? 'completed')), 'ended_at' => now(), 'remote_sdp' => null, 'duration' => isset($c['duration']) ? max(0, (int) $c['duration']) : null];
                        } elseif (! $existing->ended_at && ($c['event'] ?? '') === 'connect') {
                            $sdp = $c['session']['sdp'] ?? $c['connection']['webrtc']['sdp'] ?? null;
                            if (is_string($sdp) && strlen($sdp) < 65000) {
                                $u += ['remote_sdp' => $sdp, 'sdp_type' => $c['session']['sdp_type'] ?? ($out ? 'answer' : 'offer')];
                            }
                        }
                        DB::table('wa_calls')->where('id', $existing->id)->update($u);
                    }
                    foreach ($v['statuses'] ?? [] as $status) {
                        $state = strtolower($status['status'] ?? '');
                        if (! in_array($state, ['ringing', 'accepted', 'rejected'])) {
                            continue;
                        }
                        $q = DB::table('wa_calls')->where('wa_id', $status['id'] ?? '')->whereNull('ended_at');
                        $u = ['status' => $state, 'updated_at' => now()];
                        if ($state === 'rejected') {
                            $u += ['ended_at' => now(), 'remote_sdp' => null];
                        }
                        if ($state === 'ringing') {
                            $q->whereNotIn('status', ['accepted', 'active']);
                        }
                        $q->update($u);
                    }
                });
            }
        }
    }
}
