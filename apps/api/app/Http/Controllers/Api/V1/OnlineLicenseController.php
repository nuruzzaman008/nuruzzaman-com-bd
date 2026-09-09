<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\SoftwareLicense;
use App\Services\Licensing\OnlineLicensingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class OnlineLicenseController extends Controller
{
    public function pair(Request $request, OnlineLicensingService $service): JsonResponse
    {
        $input = $request->validate(['machine_id' => ['required', 'string', 'regex:/^[A-Za-z0-9-]{16,100}$/']]);

        return response()->json(['data' => $service->pair($input['machine_id'])])->header('Cache-Control', 'no-store');
    }

    public function confirm(Request $request, OnlineLicensingService $service): JsonResponse
    {
        $input = $request->validate(['code' => 'required|string|size:48', 'license_code' => 'required|string|max:100']);
        $service->confirm($request->user(), $input['code'], $input['license_code']);

        return response()->json(['data' => ['connected' => true]]);
    }

    public function refill(Request $request, OnlineLicensingService $service): JsonResponse
    {
        $input = $request->validate(['order_number' => 'required|string|max:100', 'license_code' => 'required|string|max:100']);
        $order = Order::where('number', $input['order_number'])->where('user_id', $request->user()->id)->firstOrFail();
        $license = SoftwareLicense::where('license_code', $input['license_code'])->where('user_id', $request->user()->id)->firstOrFail();
        $service->refill($order, $license);

        return response()->json(['data' => ['queued' => true]]);
    }

    public function delivery(Request $request, OnlineLicensingService $service): JsonResponse
    {
        abort_unless(config('online_licensing.enabled'), 503);
        $device = DB::table('nb_devices')->where('secret_hash', hash('sha256', $request->bearerToken() ?? ''))->first();
        abort_unless($device, 401);
        if (! $device->confirmed_at) {
            abort_unless($device->expires_at > now(), 410, 'Pairing expired.');

            return response()->json(['data' => ['connected' => false, 'issues' => []]]);
        }
        $service->usable(SoftwareLicense::findOrFail($device->software_license_id));
        abort_unless(DB::table('machine_bindings')->where('software_license_id', $device->software_license_id)->where('machine_id_fingerprint', $device->machine_hash)->whereNull('released_at')->exists(), 403);
        $issues = DB::table('nb_token_issues')->where('nb_device_id', $device->id)->whereNotNull('token_encrypted')->whereNull('applied_at')->orderBy('id')->get()->filter(fn ($issue) => Order::find($issue->order_id)?->status->grantsEntitlements())->map(fn ($issue) => ['id' => $issue->id, 'token' => Crypt::decryptString($issue->token_encrypted)])->values();

        return response()->json(['data' => ['connected' => true, 'issues' => $issues]])->header('Cache-Control', 'no-store');
    }

    public function acknowledge(Request $request): JsonResponse
    {
        $input = $request->validate(['id' => 'required|integer']);
        $device = DB::table('nb_devices')->where('secret_hash', hash('sha256', $request->bearerToken() ?? ''))->first();
        abort_unless($device && $device->confirmed_at, 401);
        DB::table('nb_token_issues')->where('id', $input['id'])->where('nb_device_id', $device->id)->whereNotNull('token_encrypted')->update(['applied_at' => now()]);

        return response()->json(['data' => ['acknowledged' => true]]);
    }

    private function authorizeWorker(Request $request): void
    {
        $expected = (string) config('online_licensing.worker_token');
        abort_unless(config('online_licensing.enabled') && strlen($expected) >= 64 && hash_equals($expected, $request->bearerToken() ?? ''), 401);
    }

    public function pending(Request $request, OnlineLicensingService $service): JsonResponse
    {
        $this->authorizeWorker($request);
        $jobs = [];
        foreach (DB::table('nb_token_issues')->whereNull('token_encrypted')->orderBy('id')->limit(20)->get() as $issue) {
            $license = SoftwareLicense::findOrFail($issue->software_license_id);
            if (! $license->status->isUsable() || $license->revoked_at || ($license->expires_at && $license->expires_at->isPast()) || ! $license->order->status->grantsEntitlements() || ! Order::findOrFail($issue->order_id)->status->grantsEntitlements()) {
                continue;
            }
            $jobs[] = ['id' => $issue->id, 'payload' => json_decode(Crypt::decryptString($issue->payload_encrypted), true, flags: JSON_THROW_ON_ERROR)];
        }

        return response()->json(['data' => $jobs])->header('Cache-Control', 'no-store');
    }

    public function complete(Request $request): JsonResponse
    {
        $this->authorizeWorker($request);
        $input = $request->validate(['id' => 'required|integer', 'token' => 'required|string|max:8192']);
        DB::transaction(function () use ($input) {
            $issue = DB::table('nb_token_issues')->where('id', $input['id'])->lockForUpdate()->first();
            abort_unless($issue, 404);
            $expected = json_decode(Crypt::decryptString($issue->payload_encrypted), true, flags: JSON_THROW_ON_ERROR);
            $parts = explode('.', $input['token']);
            abort_unless(count($parts) === 3 && $parts[0] === ($expected['type'] === 'ACTIVATION' ? 'NB2A' : 'NB2T'), 422);
            $actual = json_decode(base64_decode(strtr($parts[1], '-_', '+/'), true) ?: '', true);
            abort_unless($actual === $expected && strlen(base64_decode(strtr($parts[2], '-_', '+/'), true) ?: '') >= 256, 422, 'Signing payload mismatch.');
            // Only this private authenticated worker may return signatures. AutoCAD verifies RSA-PSS before applying.
            if (! $issue->token_encrypted) {
                DB::table('nb_token_issues')->where('id', $issue->id)->update(['token_encrypted' => Crypt::encryptString($input['token']), 'updated_at' => now()]);
            }
            if (! DB::table('nb_token_issues')->where('order_id', $issue->order_id)->whereNull('token_encrypted')->exists()) {
                DB::table('refill_orders')->where('order_id', $issue->order_id)->where('status', 'approved')->update(['status' => 'issued', 'issued_at' => now()]);
            }
        });

        return response()->json(['data' => ['stored' => true]]);
    }
}
