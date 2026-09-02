<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\DownloadEntitlementResource;
use App\Models\DownloadAsset;
use App\Services\Downloads\DownloadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DownloadController extends Controller
{
    public function __construct(private readonly DownloadService $downloads) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $entitlements = $request->user()->downloadEntitlements()
            ->with(['asset', 'order'])
            ->latest('id')
            ->get();

        return DownloadEntitlementResource::collection($entitlements);
    }

    /**
     * Issues access to one protected file. The asset is resolved by slug from
     * the database, never from a caller-supplied path.
     */
    public function store(Request $request, string $slug): JsonResponse|StreamedResponse
    {
        $asset = DownloadAsset::query()->where('slug', $slug)->firstOrFail();

        $result = $this->downloads->issue($request->user(), $asset, $request);

        if (isset($result['stream'])) {
            return $result['stream'];
        }

        return response()->json(['data' => $result]);
    }
}
