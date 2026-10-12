<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\WhatsApp\WhatsAppCalling;
use App\Services\WhatsApp\WhatsAppMessaging;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Symfony\Component\HttpFoundation\Response;

class WhatsAppWebhookController extends Controller
{
    public function verify(Request $r, WhatsAppMessaging $wa): Response
    {
        $s = $wa->settings();
        $token = $r->query('hub_verify_token', $r->query('hub.verify_token', ''));
        $mode = $r->query('hub_mode', $r->query('hub.mode', ''));
        abort_unless($s->verify_token && $mode === 'subscribe' && hash_equals(Crypt::decryptString($s->verify_token), (string) $token), 403);

        return response((string) $r->query('hub_challenge', $r->query('hub.challenge', '')), 200, ['Content-Type' => 'text/plain']);
    }

    public function receive(Request $r, WhatsAppMessaging $wa): Response
    {
        $s = $wa->settings();
        abort_unless($s->app_secret, 503, 'Webhook secret not configured.');
        abort_if(strlen($r->getContent()) > 2000000, 413);
        $expected = 'sha256='.hash_hmac('sha256', $r->getContent(), Crypt::decryptString($s->app_secret));
        abort_unless(hash_equals($expected, (string) $r->header('X-Hub-Signature-256', '')), 403);
        $body = json_decode($r->getContent(), true);
        abort_unless(is_array($body) && ($body['object'] ?? '') === 'whatsapp_business_account', 422);
        $wa->ingest($body);
        app(WhatsAppCalling::class)->ingest($body);

        return response()->json(['received' => true]);
    }
}
