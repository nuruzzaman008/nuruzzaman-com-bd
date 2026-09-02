<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Http\Resources\DownloadAssetResource;
use App\Models\DownloadAsset;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Public release metadata for the support pages: version, checksum and signing
 * state. The file itself is never reachable from here.
 */
class ReleaseController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $assets = DownloadAsset::query()
            ->orderByDesc('released_at')
            ->orderByDesc('id')
            ->get();

        return DownloadAssetResource::collection($assets);
    }

    public function show(string $slug): DownloadAssetResource
    {
        return new DownloadAssetResource(
            DownloadAsset::query()->where('slug', $slug)->firstOrFail()
        );
    }
}
