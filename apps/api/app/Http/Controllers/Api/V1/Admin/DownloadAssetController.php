<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DownloadAssetResource;
use App\Models\DownloadAsset;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Protected release management.
 *
 * An installer is uploaded straight to the private disk; the checksum is
 * computed here rather than trusted from the form, and nothing is servable
 * until an admin marks the release available.
 */
class DownloadAssetController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->guard($request);

        return DownloadAssetResource::collection(
            DownloadAsset::query()->latest('id')->paginate(50)
        );
    }

    public function store(Request $request): DownloadAssetResource
    {
        $this->guard($request);

        $validated = $request->validate([
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:download_assets,slug'],
            'name' => ['required', 'string', 'max:200'],
            'version' => ['nullable', 'string', 'max:40'],
            'release_notes_markdown' => ['nullable', 'string', 'max:100000'],
            'released_at' => ['nullable', 'date'],
        ]);

        $asset = DownloadAsset::create($validated + [
            'disk' => config('nb.downloads.disk'),
            'is_available' => false,
        ]);

        return new DownloadAssetResource($asset);
    }

    public function update(Request $request, DownloadAsset $downloadAsset): DownloadAssetResource
    {
        $this->guard($request);

        $validated = $request->validate([
            'slug' => ['sometimes', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('download_assets', 'slug')->ignore($downloadAsset->getKey())],
            'name' => ['sometimes', 'string', 'max:200'],
            'version' => ['sometimes', 'nullable', 'string', 'max:40'],
            'release_notes_markdown' => ['sometimes', 'nullable', 'string', 'max:100000'],
            'code_signing_status' => ['sometimes', 'string', 'in:unknown,unsigned,signed,signed_timestamped'],
            'test_status' => ['sometimes', 'string', 'in:untested,internal_tested,release_tested'],
            'released_at' => ['sometimes', 'nullable', 'date'],
            'is_available' => ['sometimes', 'boolean'],
        ]);

        // A release cannot be switched on before a file actually exists.
        if (($validated['is_available'] ?? false) && blank($downloadAsset->storage_path)) {
            abort(422, 'Upload the installer before marking this release available.');
        }

        $downloadAsset->update($validated);
        Audit::record('download_asset.updated', $downloadAsset, $validated);

        return new DownloadAssetResource($downloadAsset->fresh());
    }

    public function upload(Request $request, DownloadAsset $downloadAsset): JsonResponse
    {
        $this->guard($request);

        $request->validate([
            'file' => ['required', 'file', 'max:1048576'],
        ]);

        $file = $request->file('file');
        $disk = config('nb.downloads.disk');
        $path = $file->storeAs(
            'releases/'.$downloadAsset->slug,
            $downloadAsset->slug.'-'.($downloadAsset->version ?: 'latest').'.'.$file->getClientOriginalExtension(),
            $disk,
        );

        $downloadAsset->update([
            'disk' => $disk,
            'storage_path' => $path,
            'original_filename' => mb_substr($file->getClientOriginalName(), 0, 255),
            'size_bytes' => Storage::disk($disk)->size($path),
            // Computed from the stored bytes, never taken from the request.
            'checksum_sha256' => hash_file('sha256', $file->getRealPath()),
        ]);

        Audit::record('download_asset.uploaded', $downloadAsset, [
            'size_bytes' => $downloadAsset->size_bytes,
            'checksum_sha256' => $downloadAsset->checksum_sha256,
        ]);

        return response()->json([
            'data' => [
                'checksum_sha256' => $downloadAsset->checksum_sha256,
                'size_bytes' => $downloadAsset->size_bytes,
                'is_available' => (bool) $downloadAsset->is_available,
            ],
        ]);
    }

    private function guard(Request $request): void
    {
        abort_unless($request->user()->hasPermission('downloads.manage'), 403);
    }
}
