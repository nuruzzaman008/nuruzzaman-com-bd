<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Services\Media\MediaUsage;
use App\Support\Audit;
use App\Support\SearchTerm;
use Carbon\CarbonImmutable;
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

        $term = trim((string) $request->query('q', ''));
        $type = (string) $request->query('type', '');
        $month = (string) $request->query('month', '');
        $monthStart = preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)
            ? CarbonImmutable::createFromFormat('!Y-m', $month)
            : null;

        $media = Media::query()
            ->when($term !== '', fn ($query) => $query->where(fn ($inner) => $inner
                ->where('original_name', 'like', SearchTerm::contains($term))
                ->orWhere('alt_text', 'like', SearchTerm::contains($term))
                ->orWhere('caption', 'like', SearchTerm::contains($term))))
            ->when($type === 'image', fn ($query) => $query->where('mime_type', 'like', 'image/%'))
            ->when($type === 'pdf', fn ($query) => $query->where('mime_type', 'application/pdf'))
            ->when($monthStart, fn ($query, CarbonImmutable $start) => $query
                ->whereBetween('created_at', [$start, $start->endOfMonth()]))
            ->latest('id')
            // Seven to a row on a wide screen, six rows.
            ->paginate(42);

        // Every month something was uploaded in, for the date filter.
        $months = Media::query()
            ->whereNotNull('created_at')
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month")
            ->distinct()
            ->orderByDesc('month')
            ->pluck('month')
            ->all();

        return response()->json([
            'data' => collect($media->items())->map(fn (Media $item) => $this->present($item))->all(),
            'meta' => [
                'current_page' => $media->currentPage(),
                'last_page' => $media->lastPage(),
                'per_page' => $media->perPage(),
                'total' => $media->total(),
            ],
            'filters' => ['months' => $months],
        ]);
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

    /**
     * A file still in use is refused, naming where, until the admin confirms
     * with `force`: deleting it empties those covers and breaks those images.
     */
    public function destroy(Request $request, Media $medium, MediaUsage $usage): JsonResponse
    {
        abort_unless($request->user()->hasPermission('media.manage'), 403);

        if (! $request->boolean('force')) {
            $places = $usage->placesFor($medium);

            if ($places !== []) {
                throw DomainException::conflict('This file is still used by: '.implode('; ', $places).'.');
            }
        }

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
