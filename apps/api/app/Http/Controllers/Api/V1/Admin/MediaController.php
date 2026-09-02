<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Media uploads are validated on declared MIME type, real extension and size.
 * Files are stored under a generated name, so a crafted filename can never
 * traverse a path or be replayed as an executable.
 */
class MediaController extends Controller
{
    private const ALLOWED = [
        'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml', 'application/pdf',
    ];

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('media.manage'), 403);

        $media = Media::query()->latest('id')->paginate(40);

        return response()->json($media->through(fn (Media $item) => $this->present($item))->toArray());
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('media.manage'), 403);

        $request->validate([
            'file' => ['required', 'file', 'max:20480', 'mimetypes:'.implode(',', self::ALLOWED)],
            'alt_text' => ['nullable', 'string', 'max:255'],
            'caption' => ['nullable', 'string', 'max:512'],
            'credit' => ['nullable', 'string', 'max:160'],
        ]);

        $file = $request->file('file');
        $path = $file->store('uploads/'.now()->format('Y/m'), 'public');
        $dimensions = @getimagesize($file->getRealPath()) ?: [null, null];

        $media = Media::create([
            'uploaded_by' => $request->user()->getKey(),
            'disk' => 'public',
            'path' => $path,
            'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'width' => $dimensions[0] ?: null,
            'height' => $dimensions[1] ?: null,
            'checksum_sha256' => hash_file('sha256', $file->getRealPath()),
            'alt_text' => $request->input('alt_text'),
            'caption' => $request->input('caption'),
            'credit' => $request->input('credit'),
        ]);

        Audit::record('media.uploaded', $media, ['mime' => $media->mime_type]);

        return response()->json(['data' => $this->present($media)], 201);
    }

    public function update(Request $request, Media $medium): JsonResponse
    {
        abort_unless($request->user()->hasPermission('media.manage'), 403);

        $validated = $request->validate([
            'alt_text' => ['sometimes', 'nullable', 'string', 'max:255'],
            'caption' => ['sometimes', 'nullable', 'string', 'max:512'],
            'credit' => ['sometimes', 'nullable', 'string', 'max:160'],
            'focal_x' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'focal_y' => ['sometimes', 'numeric', 'min:0', 'max:1'],
        ]);

        $medium->update($validated);

        return response()->json(['data' => $this->present($medium->fresh())]);
    }

    public function destroy(Request $request, Media $medium): JsonResponse
    {
        abort_unless($request->user()->hasPermission('media.manage'), 403);

        Storage::disk($medium->disk)->delete($medium->path);
        Audit::record('media.deleted', $medium, ['path' => $medium->path]);
        $medium->delete();

        return response()->json(['message' => 'Media deleted.']);
    }

    private function present(Media $media): array
    {
        return [
            'id' => $media->id,
            'url' => $media->url(),
            'original_name' => $media->original_name,
            'mime_type' => $media->mime_type,
            'size_bytes' => $media->size_bytes,
            'width' => $media->width,
            'height' => $media->height,
            'alt_text' => $media->alt_text,
            'caption' => $media->caption,
            'credit' => $media->credit,
            'focal' => ['x' => $media->focal_x, 'y' => $media->focal_y],
            'uploaded_at' => $media->created_at?->toIso8601String(),
        ];
    }
}
