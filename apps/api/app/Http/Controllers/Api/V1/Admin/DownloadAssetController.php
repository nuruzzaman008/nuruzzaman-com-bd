<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DownloadAssetResource;
use App\Models\DownloadAsset;
use App\Services\Uploads\ChunkedUploads;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Protected release management.
 *
 * An installer is uploaded straight to the private disk; the checksum is
 * computed here rather than trusted from the form, and nothing is servable
 * until an admin marks the release available. Which licences give a buyer a
 * release is set here too: everyone whose order includes one of them gets it.
 */
class DownloadAssetController extends Controller
{
    /** Installers run to a few hundred MB; 300 MB is the ceiling the owner set. */
    private const MAX_INSTALLER_KB = 307200;

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->guard($request);

        return DownloadAssetResource::collection(
            DownloadAsset::query()->with('variants')->latest('id')->paginate(50)
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

        return new DownloadAssetResource($asset->load('variants'));
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

        return new DownloadAssetResource($downloadAsset->fresh()->load('variants'));
    }

    public function upload(Request $request, DownloadAsset $downloadAsset, ChunkedUploads $uploads): JsonResponse
    {
        $this->guard($request);

        $disk = config('nb.downloads.disk');
        $previousDisk = $downloadAsset->disk ?: $disk;
        $previousPath = $downloadAsset->storage_path;

        try {
            // An installer is far over the host's 2 MB per-request limit, so it
            // normally arrives in parts first.
            $file = $uploads->fileFrom($request, 'file', self::MAX_INSTALLER_KB);
            Validator::make(
                ['file' => $file],
                ['file' => ['required', 'file', 'max:'.self::MAX_INSTALLER_KB, 'extensions:exe,msi,zip']],
                ['file.extensions' => 'Upload the installer as an .exe, .msi or .zip file.'],
            )->validate();

            $path = $file->storeAs(
                'releases/'.$downloadAsset->slug,
                $downloadAsset->slug.'-'.($downloadAsset->version ?: 'latest').'.'.strtolower($file->getClientOriginalExtension()),
                $disk,
            );
            // Computed from the uploaded bytes, never taken from the request.
            $checksum = hash_file('sha256', $file->getRealPath());
            $originalName = mb_substr($file->getClientOriginalName(), 0, 255);
        } finally {
            $uploads->forgetFrom($request);
        }

        // A replaced build's old file is removed, so a new installer does not
        // leave the last one taking up space on the private disk.
        if (filled($previousPath) && ($previousPath !== $path || $previousDisk !== $disk)) {
            Storage::disk($previousDisk)->delete($previousPath);
        }

        $downloadAsset->update([
            'disk' => $disk,
            'storage_path' => $path,
            'original_filename' => $originalName,
            'size_bytes' => Storage::disk($disk)->size($path),
            'checksum_sha256' => $checksum,
        ]);

        Audit::record('download_asset.uploaded', $downloadAsset, [
            'size_bytes' => $downloadAsset->size_bytes,
            'checksum_sha256' => $downloadAsset->checksum_sha256,
        ]);

        return response()->json([
            'data' => [
                'original_filename' => $downloadAsset->original_filename,
                'checksum_sha256' => $downloadAsset->checksum_sha256,
                'size_bytes' => $downloadAsset->size_bytes,
                'is_available' => (bool) $downloadAsset->is_available,
            ],
        ]);
    }

    /**
     * Which product variants - the licences - give a buyer this release. It is
     * granted when an order is fulfilled, so a link made later reaches new
     * orders, not ones already fulfilled.
     */
    public function syncVariants(Request $request, DownloadAsset $downloadAsset): DownloadAssetResource
    {
        $this->guard($request);

        $validated = $request->validate([
            'variant_ids' => ['present', 'array'],
            'variant_ids.*' => ['integer', 'distinct', 'exists:product_variants,id'],
        ]);

        $downloadAsset->variants()->sync($validated['variant_ids']);
        Audit::record('download_asset.variants_synced', $downloadAsset, ['variant_ids' => $validated['variant_ids']]);

        return new DownloadAssetResource($downloadAsset->load('variants'));
    }

    private function guard(Request $request): void
    {
        abort_unless($request->user()->hasPermission('downloads.manage'), 403);
    }
}
