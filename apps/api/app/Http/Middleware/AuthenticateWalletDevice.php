<?php

namespace App\Http\Middleware;

use App\Models\SoftwareLicense;
use App\Services\Licensing\OnlineWalletService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateWalletDevice
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(config('offline_wallet.enabled'), 503, 'Offline wallet API is disabled.');
        $secret = $request->bearerToken() ?? '';
        $device = DB::table('nb_devices')->where('secret_hash', hash('sha256', $secret))->first();
        abort_unless($device && $device->confirmed_at, 401);
        $candidate = SoftwareLicense::find($device->software_license_id);
        abort_unless($candidate && $candidate->user && $candidate->order, 403);
        $license = app(OnlineWalletService::class)->license($secret);
        abort_unless($device->software_license_id === $license->id, 403);
        $request->attributes->set('wallet_device', (int) $device->id);
        $request->attributes->set('wallet_license', $license->id);

        return $next($request)->header('Cache-Control', 'no-store');
    }
}
