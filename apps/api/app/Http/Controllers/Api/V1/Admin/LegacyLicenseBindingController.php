<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Licensing\LegacyLicenseBindingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LegacyLicenseBindingController extends Controller
{
    public function __invoke(Request $request, LegacyLicenseBindingService $service): JsonResponse
    {
        return response()->json($service->bind($request->user(), $request->all()))->header('Cache-Control', 'no-store');
    }
}
