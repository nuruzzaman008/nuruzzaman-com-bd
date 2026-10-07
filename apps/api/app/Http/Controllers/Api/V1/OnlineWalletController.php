<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Licensing\OnlineWalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OnlineWalletController extends Controller
{
    public function balance(Request $request, OnlineWalletService $service): JsonResponse
    {
        $license = $service->license($request->bearerToken() ?? '');

        return response()->json(['data' => ['balance' => $service->balance($license), 'license_code' => $license->license_code, 'customer' => $license->user->name]])->header('Cache-Control', 'no-store');
    }

    public function operation(Request $request, OnlineWalletService $service): JsonResponse
    {
        $license = $service->license($request->bearerToken() ?? '');
        $input = $request->validate(['command' => ['required', 'string', 'max:80'], 'units' => ['required', 'integer', 'between:1,10000'], 'operation_id' => ['sometimes', 'required', 'uuid']]);

        return response()->json(['data' => $service->operation($license, strtoupper($input['command']), $input['units'], $input['operation_id'] ?? null)])->header('Cache-Control', 'no-store');
    }
}
