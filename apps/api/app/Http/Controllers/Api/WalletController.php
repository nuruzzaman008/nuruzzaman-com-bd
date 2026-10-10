<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\WalletConnectRequest;
use App\Http\Requests\WalletHistoryRequest;
use App\Http\Requests\WalletSyncRequest;
use App\Models\SoftwareLicense;
use App\Services\Licensing\OfflineWalletLedger;
use App\Services\Licensing\OfflineWalletPolicy;
use App\Services\Licensing\SqlOfflineWalletLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class WalletController extends Controller
{
    public function command(Request $request, SqlOfflineWalletLedger $ledger): JsonResponse
    {
        $v = $request->validate(['command' => ['required', 'string', 'max:80'], 'units' => ['required', 'integer', 'between:1,10000'], 'transaction_id' => ['sometimes', 'required', 'uuid']]);

        return response()->json(['data' => $ledger->command($request->attributes->get('wallet_device'), strtoupper($v['command']), $v['units'], $v['transaction_id'] ?? null)]);
    }

    public function connect(WalletConnectRequest $request, OfflineWalletLedger $ledger): JsonResponse
    {
        $v = $request->validated();

        return response()->json($ledger->reserve($request->attributes->get('wallet_license'), $request->attributes->get('wallet_device'), $v['request_id'], $v['requested_allowance'], $v['expected_version'], OfflineWalletPolicy::configured()));
    }

    public function balance(Request $request, OfflineWalletLedger $ledger): JsonResponse
    {
        $license = $request->attributes->get('wallet_license');
        $last = DB::table('nb_wallet_syncs')->where('license_id', $license)->where('status', 'accepted')->max('completed_at');
        $owner = SoftwareLicense::with('user')->findOrFail($license);

        return response()->json(['data' => ['wallet' => $ledger->balance($license), 'identity' => ['email' => $owner->user->email, 'license_code' => $owner->license_code, 'device_id' => $request->attributes->get('wallet_device')], 'server_time' => now()->utc()->format('Y-m-d\TH:i:s\Z'), 'last_sync_at' => $last ? Carbon::parse($last)->utc()->format('Y-m-d\TH:i:s\Z') : null]]);
    }

    public function sync(WalletSyncRequest $request, OfflineWalletLedger $ledger): JsonResponse
    {
        $v = $request->validated();

        return response()->json($ledger->sync($request->attributes->get('wallet_device'), $v['request_id'], $v['lease_id'], $v['expected_version'], $v['transactions']));
    }

    public function history(WalletHistoryRequest $request, OfflineWalletLedger $ledger): JsonResponse
    {
        $v = $request->validated();

        return response()->json($ledger->history($request->attributes->get('wallet_license'), $v['cursor'] ?? null, $v['limit'] ?? 25));
    }
}
