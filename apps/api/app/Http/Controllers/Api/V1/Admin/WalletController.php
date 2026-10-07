<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminWalletActionRequest;
use App\Services\Licensing\AdminWalletService;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WalletController extends Controller
{
    private function wallets(): Builder
    {
        return DB::table('nb_online_wallets as w')->join('software_licenses as l', 'l.id', '=', 'w.software_license_id')
            ->leftJoin('users as u', 'u.id', '=', 'l.user_id')
            ->select('w.software_license_id as id', 'l.license_code', 'l.status as license_status', 'u.name', 'u.email', 'w.balance', 'w.available_balance', 'w.reserved_balance', 'w.status', 'w.version')
            ->selectSub(DB::table('nb_wallet_syncs as s')->whereColumn('s.license_id', 'w.software_license_id')->where('s.status', 'accepted')->selectRaw('MAX(s.completed_at)'), 'last_sync');
    }

    public function index(Request $request): JsonResponse
    {
        $input = $request->validate(['q' => ['nullable', 'string', 'max:150'], 'page' => ['sometimes', 'integer', 'min:1']]);
        $query = $this->wallets();
        if (! empty($input['q'])) {
            $term = '%'.addcslashes($input['q'], '%_\\').'%';
            $query->where(fn ($q) => $q->where('u.name', 'like', $term)->orWhere('u.email', 'like', $term)->orWhere('l.license_code', 'like', $term));
        }
        $page = $query->orderByDesc('w.software_license_id')->paginate(20);

        return response()->json(['data' => $page->items(), 'meta' => ['page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()]]);
    }

    public function show(Request $request, int $license): JsonResponse
    {
        $request->validate(['page' => ['sometimes', 'integer', 'min:1'], 'device_page' => ['sometimes', 'integer', 'min:1'], 'sync_page' => ['sometimes', 'integer', 'min:1']]);
        $wallet = $this->wallets()->where('w.software_license_id', $license)->first();
        abort_unless($wallet, 404);
        $entries = DB::table('nb_wallet_entries')->where('software_license_id', $license)->orderByDesc('id')
            ->select('id', 'transaction_id', 'action_type', 'source', 'delta', 'balance', 'reason', 'reference_note', 'created_by', 'payment_id', 'order_id', 'status_before', 'status_after', 'created_at')->paginate(25);
        $devices = DB::table('nb_devices as d')->where('d.software_license_id', $license)->select('d.id', 'd.confirmed_at', 'd.revoked_at', 'd.revocation_reason', 'd.last_seen_at')
            ->selectSub(DB::table('nb_wallet_syncs as s')->whereColumn('s.device_id', 'd.id')->orderByDesc('s.created_at')->limit(1)->select('s.status'), 'last_sync_status')
            ->selectSub(DB::table('nb_wallet_syncs as s')->whereColumn('s.device_id', 'd.id')->orderByDesc('s.created_at')->limit(1)->select('s.completed_at'), 'last_sync')
            ->selectSub(DB::table('nb_wallet_leases as l')->whereColumn('l.device_id', 'd.id')->orderByDesc('l.issued_at')->limit(1)->select('l.sync_due_at'), 'sync_due_at')
            ->selectSub(DB::table('nb_wallet_leases as l')->whereColumn('l.device_id', 'd.id')->orderByDesc('l.issued_at')->limit(1)->select('l.expires_at'), 'expires_at')
            ->orderByDesc('d.id')->paginate(20, ['*'], 'device_page');

        $syncs = DB::table('nb_wallet_syncs')->where('license_id', $license)
            ->select('id', 'request_id', 'device_id', 'status', 'accepted_count', 'error_code', 'created_at', 'completed_at')
            ->orderByDesc('created_at')->orderByDesc('id')->paginate(20, ['*'], 'sync_page');

        return response()->json(['data' => ['wallet' => $wallet, 'entries' => $entries->items(), 'devices' => $devices->items(), 'syncs' => $syncs->items(), 'can_manage' => $request->user()->hasPermission('wallets.manage')], 'meta' => ['page' => $entries->currentPage(), 'last_page' => $entries->lastPage(), 'device_page' => $devices->currentPage(), 'device_last_page' => $devices->lastPage(), 'sync_page' => $syncs->currentPage(), 'sync_last_page' => $syncs->lastPage()]]);
    }

    public function action(AdminWalletActionRequest $request, int $license, AdminWalletService $service): JsonResponse
    {
        return response()->json($service->act($request->user(), $license, $request->validated()));
    }
}
