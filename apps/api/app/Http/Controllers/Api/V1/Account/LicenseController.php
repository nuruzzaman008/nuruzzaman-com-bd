<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\SoftwareLicenseResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class LicenseController extends Controller
{
    public function wallet(Request $request, string $code): JsonResponse
    {
        $request->validate(['page' => ['sometimes', 'integer', 'min:1']]);
        $license = $request->user()->softwareLicenses()->where('license_code', $code)->firstOrFail();
        $wallet = DB::table('nb_online_wallets')->where('software_license_id', $license->id)->first(['balance', 'reserved_balance', 'available_balance', 'status', 'version']);
        $entries = DB::table('nb_wallet_entries')->where('software_license_id', $license->id)->orderByDesc('id')
            ->select('transaction_id', 'source', 'action_type', 'delta', 'balance', 'created_at')->paginate(25);
        $devices = DB::table('nb_devices')->where('software_license_id', $license->id)->orderByDesc('id')->limit(50)
            ->get(['id', 'confirmed_at', 'revoked_at', 'last_seen_at']);
        $lastSync = DB::table('nb_wallet_syncs')->where('license_id', $license->id)->where('status', 'accepted')->max('completed_at');

        return response()->json(['data' => ['license_code' => $license->license_code, 'license_status' => $license->status->value, 'wallet' => $wallet, 'devices' => $devices, 'last_sync' => $lastSync, 'entries' => $entries->items()], 'meta' => ['page' => $entries->currentPage(), 'last_page' => $entries->lastPage()]])->header('Cache-Control', 'no-store');
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $licenses = $request->user()->softwareLicenses()
            ->with(['order', 'machineBindings'])
            ->latest('id')
            ->get();

        return SoftwareLicenseResource::collection($licenses);
    }
}
