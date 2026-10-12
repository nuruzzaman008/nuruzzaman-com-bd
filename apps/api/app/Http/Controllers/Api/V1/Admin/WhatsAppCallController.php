<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\WhatsApp\WhatsAppCalling;
use App\Services\WhatsApp\WhatsAppMessaging;
use Carbon\Carbon;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WhatsAppCallController extends Controller
{
    public function index(Request $r): JsonResponse
    {
        $key = $r->validate(['session_key' => 'required|uuid'])['session_key'];
        $rows = DB::table('wa_calls')->orderByDesc('id')->limit(30)->get();
        foreach ($rows as $c) {
            $c->mine = $c->actor_id === $r->user()->id && $c->session_key === $key;
            $c->owned = $c->actor_id === $r->user()->id;
            $c->claimable = $c->actor_id === null && $c->direction === 'inbound' && ! $c->ended_at && Carbon::parse($c->created_at)->gt(now()->subSeconds(60));
            if (! $c->mine) {
                $c->remote_sdp = null;
            }
            unset($c->session_key,$c->client_key);
        }

        return response()->json(['data' => $rows]);
    }

    public function permission(Request $r, int $id, WhatsAppCalling $wa): JsonResponse
    {
        $c = DB::table('wa_contacts')->where('id', $id)->firstOrFail();
        abort_if($c->opt_out || $c->suppressed, 422, 'Contact is opted out or suppressed.');

        return response()->json(['data' => $wa->permission($c->phone)]);
    }

    public function requestPermission(Request $r, int $id, WhatsAppCalling $calls, WhatsAppMessaging $wa): JsonResponse
    {
        $data = $r->validate(['client_key' => 'required|uuid']);
        $c = DB::table('wa_contacts')->where('id', $id)->firstOrFail();
        abort_unless($calls->allowed($calls->permission($c->phone), 'send_call_permission_request'), 422, 'Meta call permission request limit reached.');
        $m = $wa->reserve($id, ['kind' => 'call_permission', 'body' => 'আপনার সঙ্গে WhatsApp call-এ কথা বলতে চাই। অনুমতি দিলে কল করতে পারব।', 'client_key' => $data['client_key']], $r->user()->id);

        return response()->json(['data' => $wa->dispatch($m->id)]);
    }

    public function connect(Request $r, int $id, WhatsAppCalling $wa): JsonResponse
    {
        $data = $r->validate(['client_key' => 'required|uuid', 'session_key' => 'required|uuid', 'sdp' => 'required|string|max:65000']);
        abort_unless(str_starts_with($data['sdp'], 'v=0'), 422, 'Invalid audio session.');
        $c = DB::table('wa_contacts')->where('id', $id)->firstOrFail();
        abort_if($c->opt_out || $c->suppressed, 422, 'Contact is opted out or suppressed.');
        $s = app(WhatsAppMessaging::class)->settings();
        abort_unless($s->enabled, 422, 'Sending is disabled.');
        $existing = DB::table('wa_calls')->where('client_key', $data['client_key'])->first();
        if ($existing) {
            abort_unless($existing->actor_id === $r->user()->id && $existing->session_key === $data['session_key'] && $existing->phone === $c->phone, 409);

            return response()->json(['data' => ['id' => $existing->id, 'status' => $existing->status]]);
        }
        abort_unless($wa->allowed($wa->permission($c->phone), 'start_call'), 422, 'Contact must grant WhatsApp call permission first.');
        $callId = DB::transaction(function () use ($data, $r, $c) {
            DB::table('wa_settings')->where('id', 1)->lockForUpdate()->first();
            $existing = DB::table('wa_calls')->where('client_key', $data['client_key'])->first();
            abort_if($existing, 409, 'This call request was already attempted.');
            abort_if(DB::table('wa_calls')->where('actor_id', $r->user()->id)->whereNull('ended_at')->exists(), 409, 'End your previous call first.');

            return DB::table('wa_calls')->insertGetId(['client_key' => $data['client_key'], 'session_key' => $data['session_key'], 'actor_id' => $r->user()->id, 'phone' => $c->phone, 'name' => $c->name, 'direction' => 'outbound', 'status' => 'connecting', 'created_at' => now(), 'updated_at' => now()]);
        });
        try {
            $response = $wa->http()->post($wa->url('calls'), ['messaging_product' => 'whatsapp', 'to' => $c->phone, 'action' => 'connect', 'session' => ['sdp_type' => 'offer', 'sdp' => $data['sdp']], 'biz_opaque_callback_data' => $data['client_key']]);
            $remote = $response->json('calls.0.id');
            if (! $response->successful() || ! $remote) {
                DB::table('wa_calls')->where('id', $callId)->update(['status' => 'failed', 'ended_at' => now(), 'error' => 'Meta error '.$response->json('error.code', 'UNKNOWN')]);
                abort(422, 'Meta could not start the call. Code: '.$response->json('error.code', 'UNKNOWN'));
            }
            DB::table('wa_calls')->where('id', $callId)->update(['wa_id' => $remote, 'updated_at' => now()]);
        } catch (ConnectionException) {
            DB::table('wa_calls')->where('id', $callId)->update(['status' => 'uncertain', 'error' => 'Connection result unknown. Do not retry; reconcile with Meta.']);
            abort(422, 'Call result unknown. Check call history before another attempt.');
        }

        return response()->json(['data' => ['id' => $callId, 'status' => 'connecting']]);
    }

    public function action(Request $r, int $id, WhatsAppCalling $wa): JsonResponse
    {
        $data = $r->validate(['session_key' => 'required|uuid', 'action' => 'required|in:claim,pre_accept,accept,reject,terminate', 'sdp' => 'nullable|string|max:65000']);

        return DB::transaction(function () use ($r, $id, $data, $wa) {
            DB::table('wa_settings')->where('id', 1)->lockForUpdate()->first();
            $c = DB::table('wa_calls')->where('id', $id)->lockForUpdate()->firstOrFail();
            abort_if($c->ended_at, 409, 'Call has ended.');
            if ($data['action'] === 'claim') {
                abort_unless($c->direction === 'inbound' && (! $c->actor_id || ($c->actor_id === $r->user()->id && $c->session_key === $data['session_key'])), 409, 'Another operator answered this call.');
                abort_unless(Carbon::parse($c->created_at)->gt(now()->subSeconds(60)), 409, 'Call timed out.');
                abort_if(DB::table('wa_calls')->where('actor_id', $r->user()->id)->where('id', '!=', $id)->whereNull('ended_at')->exists(), 409, 'End your previous call first.');
                DB::table('wa_calls')->where('id', $id)->update(['actor_id' => $r->user()->id, 'session_key' => $data['session_key']]);

                return response()->json(['data' => ['id' => $id, 'sdp' => $c->remote_sdp, 'sdp_type' => $c->sdp_type]]);
            }
            abort_unless($c->actor_id === $r->user()->id && ($c->session_key === $data['session_key'] || $data['action'] === 'terminate'), 409, 'This call belongs to another operator or tab.');
            $payload = ['messaging_product' => 'whatsapp', 'call_id' => $c->wa_id, 'action' => $data['action']];
            if (in_array($data['action'], ['pre_accept', 'accept'])) {
                abort_unless(app(WhatsAppMessaging::class)->settings()->enabled, 422, 'Sending is disabled.');
                abort_unless($c->direction === 'inbound' && str_starts_with($data['sdp'] ?? '', 'v=0'), 422, 'Audio answer required.');
                $payload['session'] = ['sdp_type' => 'answer', 'sdp' => $data['sdp']];
            }
            abort_unless($c->wa_id, 422, 'Meta has not returned a call ID yet.');
            $response = $wa->http()->post($wa->url('calls'), $payload);
            abort_unless($response->successful() && $response->json('success'), 422, 'Meta call action failed. Code: '.$response->json('error.code', 'UNKNOWN'));
            $end = in_array($data['action'], ['reject', 'terminate']);
            DB::table('wa_calls')->where('id', $id)->update(['status' => $end ? $data['action'] : ($data['action'] === 'accept' ? 'active' : 'connecting'), 'ended_at' => $end ? now() : null, 'remote_sdp' => $end ? null : $c->remote_sdp, 'updated_at' => now()]);

            return response()->json(['success' => true]);
        });
    }
}
