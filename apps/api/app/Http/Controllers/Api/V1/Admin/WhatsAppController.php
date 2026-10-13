<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\WhatsApp\WhatsAppMessaging;
use App\Services\WhatsApp\WhatsAppOrderConfirmation;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class WhatsAppController extends Controller
{
    public function overview(WhatsAppMessaging $wa): JsonResponse
    {
        $s = $wa->settings();
        $contacts = DB::table('wa_contacts')->count();
        $confirmed = DB::table('wa_contacts')->whereExists(function ($query) {
            $query->selectRaw('1')->from('wa_messages')
                ->whereColumn('wa_messages.contact_id', 'wa_contacts.id')
                ->whereNotNull('wa_id')
                ->where(function ($evidence) {
                    $evidence->where('direction', 'inbound')
                        ->orWhere(function ($outbound) {
                            $outbound->where('direction', 'outbound')->whereIn('status', ['delivered', 'read']);
                        });
                });
        })->count();

        return response()->json(['data' => [
            'enabled' => (bool) $s->enabled, 'configured' => (bool) $s->access_token,
            'campaign_enabled' => (bool) $s->campaign_enabled, 'test_received' => (bool) $s->test_received,
            'remaining' => $wa->quota($s), 'daily_limit' => $s->daily_limit,
            'template' => WhatsAppMessaging::TEMPLATE, 'language' => 'bn',
            'phone_number_id' => $s->phone_number_id, 'waba_id' => $s->waba_id,
            'api_version' => $s->api_version, 'webhook_at' => $s->webhook_at,
            'webhook_url' => rtrim(config('app.url'), '/').'/api/v1/whatsapp/webhook',
            'secret_configured' => (bool) $s->app_secret, 'verify_configured' => (bool) $s->verify_token,
            'unread' => (int) DB::table('wa_contacts')->sum('unread'),
            'contacts' => $contacts,
            'whatsapp_confirmed' => $confirmed,
            'whatsapp_unverified' => $contacts - $confirmed,
            'queued' => DB::table('wa_messages')->where('status', 'queued')->count(),
            'confirmation_template' => WhatsAppOrderConfirmation::TEMPLATE,
            'confirmation_approved' => (bool) Cache::get('wa-order-template-approved', false),
            'confirmation_pending' => DB::table('wa_order_confirmations')->where('status', 'pending')->count(),
            'recent_statuses' => DB::table('wa_messages')->select('status', DB::raw('COUNT(*) as total'))->where('direction', 'outbound')->where('occurred_at', '>=', now()->subDay())->groupBy('status')->get(),
        ]]);
    }

    public function settings(Request $r, WhatsAppMessaging $wa): JsonResponse
    {
        $v = $r->validate([
            'enabled' => ['required', 'boolean'], 'campaign_enabled' => ['required', 'boolean'],
            'test_received' => ['required', 'boolean'], 'daily_limit' => ['required', 'integer', 'between:1,50'],
            'access_token' => ['nullable', 'string', 'max:4096'], 'app_secret' => ['nullable', 'string', 'max:255'],
            'verify_token' => ['nullable', 'string', 'min:16', 'max:255'],
        ]);
        DB::transaction(function () use ($v) {
            $s = DB::table('wa_settings')->where('id', 1)->lockForUpdate()->firstOrFail();
            $update = ['enabled' => $v['enabled'], 'campaign_enabled' => $v['campaign_enabled'], 'test_received' => $v['test_received'], 'daily_limit' => $v['daily_limit'], 'updated_at' => now()];
            foreach (['access_token', 'app_secret', 'verify_token'] as $secret) {
                if (! empty($v[$secret])) {
                    $update[$secret] = Crypt::encryptString($v[$secret]);
                }
            }
            abort_if($v['enabled'] && empty($update['access_token']) && ! $s->access_token, 422, 'Access token required.');
            if ($v['test_received']) {
                abort_unless(DB::table('wa_messages')->where('mode', 'test')->whereIn('status', ['accepted', 'sent', 'delivered', 'read'])->exists(), 422, 'Send a dashboard test before confirming receipt.');
            }
            abort_if($v['campaign_enabled'] && ! $v['test_received'], 422, 'Confirm the test receipt before enabling campaigns.');
            DB::table('wa_settings')->where('id', 1)->update($update);
        });

        return $this->overview($wa);
    }

    public function connection(WhatsAppMessaging $wa): JsonResponse
    {
        $s = $wa->settings();
        abort_unless($s->access_token, 422, 'Save the access token first.');
        $http = Http::withToken(Crypt::decryptString($s->access_token))->timeout(20);
        $phone = $http->get('https://graph.facebook.com/'.$s->api_version.'/'.$s->phone_number_id, ['fields' => 'display_phone_number,verified_name']);
        abort_unless($phone->successful(), 422, 'Meta connection failed. Verify the token permissions and phone ID.');
        $templates = $http->get('https://graph.facebook.com/'.$s->api_version.'/'.$s->waba_id.'/message_templates', ['name' => WhatsAppMessaging::TEMPLATE, 'limit' => 100]);
        $approved = collect($templates->json('data', []))->contains(fn ($t) => $t['name'] === WhatsAppMessaging::TEMPLATE && $t['language'] === 'bn' && $t['status'] === 'APPROVED');

        return response()->json(['data' => ['display_phone_number' => $phone->json('display_phone_number'), 'verified_name' => $phone->json('verified_name'), 'template_approved' => $approved]]);
    }

    public function contacts(Request $r): JsonResponse
    {
        $v = $r->validate(['q' => ['nullable', 'string', 'max:100'], 'filter' => ['nullable', Rule::in(['all', 'unread', 'open', 'resolved', 'opted_out'])], 'page' => ['nullable', 'integer', 'min:1']]);
        $q = DB::table('wa_contacts');
        if (! empty($v['q'])) {
            $term = '%'.addcslashes($v['q'], '%_\\').'%';
            $q->where(fn ($q) => $q->where('phone', 'like', $term)->orWhere('name', 'like', $term)->orWhere('tags', 'like', $term));
        }
        if (($v['filter'] ?? '') === 'unread') {
            $q->where('unread', '>', 0);
        } elseif (in_array($v['filter'] ?? '', ['open', 'resolved'])) {
            $q->where('stage', $v['filter']);
        } elseif (($v['filter'] ?? '') === 'opted_out') {
            $q->where('opt_out', true);
        }
        $p = $q->orderByDesc('last_message_at')->orderByDesc('id')->paginate(30);

        return response()->json(['data' => $p->items(), 'meta' => ['page' => $p->currentPage(), 'last_page' => $p->lastPage(), 'total' => $p->total()]]);
    }

    public function saveContact(Request $r, WhatsAppMessaging $wa, ?int $id = null): JsonResponse
    {
        $v = $r->validate([
            'phone' => [$id ? 'sometimes' : 'required', 'string', 'max:30'],
            'name' => ['nullable', 'string', 'max:255'], 'opt_in' => ['sometimes', 'boolean'],
            'consent_source' => ['required_if:opt_in,true', 'nullable', 'string', 'max:255'],
            'opt_out' => ['sometimes', 'boolean'], 'suppressed' => ['sometimes', 'boolean'],
            'stage' => ['sometimes', Rule::in(['open', 'resolved'])], 'tags' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'], 'assigned_to' => ['nullable', 'integer', Rule::exists('users', 'id')],
        ]);
        if (isset($v['assigned_to'])) {
            abort_unless(DB::table('role_user')->join('roles', 'roles.id', '=', 'role_user.role_id')->where('role_user.user_id', $v['assigned_to'])->whereIn('roles.name', ['admin', 'super_admin'])->exists(), 422, 'Assign conversations only to admins.');
        }
        if (isset($v['phone'])) {
            $v['phone'] = $wa->phone($v['phone']);
            abort_if(DB::table('wa_contacts')->where('phone', $v['phone'])->when($id, fn ($q) => $q->where('id', '!=', $id))->exists(), 422, 'This number already exists.');
        }
        if ($v['opt_in'] ?? false) {
            $v['consented_at'] = now();
        }
        $v['updated_at'] = now();
        if ($id) {
            DB::table('wa_contacts')->where('id', $id)->firstOrFail();
            DB::table('wa_contacts')->where('id', $id)->update($v);
        } else {
            $id = DB::table('wa_contacts')->insertGetId($v + ['created_at' => now()]);
        }

        return response()->json(['data' => DB::table('wa_contacts')->where('id', $id)->firstOrFail()]);
    }

    public function import(Request $r, WhatsAppMessaging $wa): JsonResponse
    {
        $v = $r->validate(['contacts' => ['required', 'array', 'min:1', 'max:1000'],
            'contacts.*.phone' => ['nullable', 'string', 'max:30'], 'contacts.*.name' => ['nullable', 'string', 'max:255'],
            'contacts.*.opt_in' => ['required', 'boolean'], 'contacts.*.consent_source' => ['nullable', 'string', 'max:255'],
            'contacts.*.opt_out' => ['required', 'boolean'], 'contacts.*.suppressed' => ['required', 'boolean']]);
        $invalidRows = [];
        $count = DB::transaction(function () use ($v, $wa, &$invalidRows) {
            $count = 0;
            foreach ($v['contacts'] as $index => $contact) {
                try {
                    $contact['phone'] = $wa->phone($contact['phone'] ?? '');
                } catch (ValidationException $e) {
                    $invalidRows[] = $index + 2;

                    continue;
                }
                abort_if($contact['opt_in'] && empty($contact['consent_source']), 422, 'Every opted-in row needs a consent source.');
                if (DB::table('wa_contacts')->where('phone', $contact['phone'])->exists()) {
                    continue;
                }
                DB::table('wa_contacts')->insert($contact + ['consented_at' => $contact['opt_in'] ? now() : null, 'created_at' => now(), 'updated_at' => now()]);
                $count++;
            }

            return $count;
        });

        return response()->json(['data' => ['imported' => $count, 'skipped' => count($v['contacts']) - $count - count($invalidRows), 'invalid' => count($invalidRows), 'invalid_rows' => $invalidRows]]);
    }

    public function messages(Request $r, int $id): JsonResponse
    {
        $r->validate(['before' => ['nullable', 'integer', 'min:1']]);
        $contact = DB::table('wa_contacts')->where('id', $id)->firstOrFail();
        $messages = DB::table('wa_messages')->where('contact_id', $id)->where('kind', '!=', 'reaction')->when($r->integer('before'), fn ($q, $before) => $q->where('id', '<', $before))->orderByDesc('id')->limit(100)->get()->reverse()->values();
        $targets = $messages->keyBy('wa_id');
        foreach (DB::table('wa_messages')->where('contact_id', $id)->where('kind', 'reaction')->orderBy('occurred_at')->orderBy('id')->get() as $reaction) {
            $details = json_decode($reaction->body ?? '', true);
            $targetId = $details['message_id'] ?? null;
            $target = is_string($targetId) && $targetId !== '' ? $targets->get($targetId) : null;
            if ($target && is_string($details['emoji'] ?? null)) {
                $target->reactions = $details['emoji'] === '' ? [] : [$details['emoji']];
            }
        }

        return response()->json(['data' => $messages, 'contact' => $contact, 'reply_window_open' => $contact->last_inbound_at && Carbon::parse($contact->last_inbound_at)->gt(now()->subDay()), 'older_before' => $messages->count() === 100 ? $messages->first()->id : null]);
    }

    public function read(Request $r, int $id): JsonResponse
    {
        $v = $r->validate(['through' => ['required', 'integer', 'min:1']]);
        DB::transaction(function () use ($id, $v) {
            DB::table('wa_contacts')->where('id', $id)->lockForUpdate()->firstOrFail();
            abort_unless(DB::table('wa_messages')->where('contact_id', $id)->where('id', $v['through'])->exists(), 422);
            $remaining = DB::table('wa_messages')->where('contact_id', $id)->where('direction', 'inbound')->where('kind', '!=', 'reaction')->where('id', '>', $v['through'])->count();
            DB::table('wa_contacts')->where('id', $id)->update(['unread' => $remaining]);
        });

        return response()->json(['data' => ['read' => true]]);
    }

    public function send(Request $r, WhatsAppMessaging $wa, int $id): JsonResponse
    {
        $v = $r->validate([
            'client_key' => ['required', 'uuid'], 'kind' => ['required', Rule::in(['template', 'text', 'image', 'document', 'audio', 'video'])],
            'test' => ['sometimes', 'boolean'], 'manual' => ['sometimes', 'boolean'], 'body' => ['required_if:kind,text', 'nullable', 'string', 'max:4096'],
            'media_id' => ['required_if:kind,image,document,audio,video', 'nullable', 'string', 'regex:/^\d+$/'],
            'filename' => ['nullable', 'string', 'max:255'], 'template' => ['sometimes', Rule::in([WhatsAppMessaging::TEMPLATE])],
        ]);
        $message = $wa->reserve($id, $v, $r->user()->id);

        return response()->json(['data' => $wa->dispatch($message->id)]);
    }

    public function campaign(Request $r, WhatsAppMessaging $wa): JsonResponse
    {
        $v = $r->validate(['contact_ids' => ['required', 'array', 'min:1', 'max:50'], 'contact_ids.*' => ['required', 'integer', 'distinct', Rule::exists('wa_contacts', 'id')]]);
        $ids = $wa->campaign($v['contact_ids'], $r->user()->id);

        return response()->json(['data' => ['queued' => count($ids), 'message_ids' => $ids, 'remaining' => $wa->quota($wa->settings())]], 202);
    }

    public function staff(): JsonResponse
    {
        return response()->json(['data' => DB::table('users')->join('role_user', 'users.id', '=', 'role_user.user_id')->join('roles', 'roles.id', '=', 'role_user.role_id')->whereIn('roles.name', ['admin', 'super_admin'])->select('users.id', 'users.name')->distinct()->get()]);
    }

    public function upload(Request $r, WhatsAppMessaging $wa): JsonResponse
    {
        $v = $r->validate(['base64' => ['required', 'string', 'max:14000000'], 'filename' => ['required', 'string', 'max:255']]);
        $bytes = base64_decode($v['base64'], true);
        abort_unless($bytes !== false && strlen($bytes) <= 10000000, 422, 'File must be under 10 MB.');
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $types = ['image/jpeg' => 'image', 'image/png' => 'image', 'application/pdf' => 'document', 'audio/mpeg' => 'audio', 'audio/ogg' => 'audio', 'video/mp4' => 'video'];
        abort_unless(isset($types[$mime]), 422, 'Use JPG, PNG, PDF, MP3, OGG or MP4.');
        $s = $wa->settings();
        abort_unless($s->enabled && $s->access_token, 422, 'Connect WhatsApp first.');
        $response = Http::withToken(Crypt::decryptString($s->access_token))->timeout(40)->attach('file', $bytes, basename($v['filename']), ['Content-Type' => $mime])
            ->post('https://graph.facebook.com/'.$s->api_version.'/'.$s->phone_number_id.'/media', ['messaging_product' => 'whatsapp', 'type' => $mime]);
        abort_unless($response->successful() && $response->json('id'), 422, 'Meta media upload failed.');

        return response()->json(['data' => ['media_id' => $response->json('id'), 'kind' => $types[$mime], 'filename' => basename($v['filename'])]]);
    }

    public function media(int $id, WhatsAppMessaging $wa): Response
    {
        $message = DB::table('wa_messages')->where('id', $id)->firstOrFail();
        abort_unless($message->media_id && preg_match('/^\d+$/', $message->media_id), 404);
        $s = $wa->settings();
        abort_unless($s->access_token, 422, 'Connect WhatsApp first.');
        $token = Crypt::decryptString($s->access_token);
        $meta = Http::withToken($token)->timeout(15)->get('https://graph.facebook.com/'.$s->api_version.'/'.$message->media_id);
        $url = $meta->json('url');
        $host = parse_url((string) $url, PHP_URL_HOST);
        abort_unless($meta->successful() && parse_url((string) $url, PHP_URL_SCHEME) === 'https'
            && in_array($host, ['lookaside.fbsbx.com', 'mmg.whatsapp.net']) && (int) $meta->json('file_size', 0) <= 20000000, 422, 'Media link unavailable or unsupported.');
        $file = Http::withToken($token)->withoutRedirecting()->timeout(25)->get($url);
        abort_unless($file->successful() && strlen($file->body()) <= 20000000, 422, 'Media download failed.');
        $name = preg_replace('/[^A-Za-z0-9._-]/', '_', $message->filename ?: 'attachment');
        $mime = strtolower(explode(';', $file->header('Content-Type') ?: (string) $meta->json('mime_type', ''))[0]);
        $inline = $message->kind === 'image' && in_array($mime, ['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

        return response($file->body(), 200, ['Content-Type' => $inline ? $mime : 'application/octet-stream', 'Content-Disposition' => ($inline ? 'inline' : 'attachment').'; filename="'.$name.'"', 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store']);
    }
}
