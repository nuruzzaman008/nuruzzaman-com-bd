<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Services\Content\RevalidationService;
use App\Services\Media\ImageEditor;
use App\Services\Media\MediaUsage;
use App\Services\Uploads\ChunkedUploads;
use App\Support\Audit;
use App\Support\SearchTerm;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

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

    /** Played in the browser as they are, so only formats every browser plays. */
    private const VIDEO = ['video/mp4', 'video/webm'];

    private const MAX_FILE_KB = 20480;

    /** A video arrives in 1 MB parts; ChunkedUploads accepts up to 320 of them. */
    private const MAX_VIDEO_KB = 307200;

    public function index(Request $request): JsonResponse
    {
        $this->guard($request);

        $term = trim((string) $request->query('q', ''));
        $type = (string) $request->query('type', '');
        $month = (string) $request->query('month', '');
        $monthStart = preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)
            ? CarbonImmutable::createFromFormat('!Y-m', $month)
            : null;

        $media = Media::query()
            ->with('uploader:id,name')
            ->when($term !== '', fn ($query) => $query->where(fn ($inner) => $inner
                ->where('original_name', 'like', SearchTerm::contains($term))
                ->orWhere('title', 'like', SearchTerm::contains($term))
                ->orWhere('alt_text', 'like', SearchTerm::contains($term))
                ->orWhere('caption', 'like', SearchTerm::contains($term))))
            ->when($type === 'image', fn ($query) => $query->where('mime_type', 'like', 'image/%'))
            ->when($type === 'video', fn ($query) => $query->where('mime_type', 'like', 'video/%'))
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

    /** One file's attachment details, with where it is used. */
    public function show(Request $request, Media $medium, MediaUsage $usage): JsonResponse
    {
        $this->guard($request);

        return response()->json(['data' => $this->detail($medium, $usage)]);
    }

    public function store(Request $request, ChunkedUploads $uploads): JsonResponse
    {
        $this->guard($request);

        $details = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'alt_text' => ['nullable', 'string', 'max:255'],
            'caption' => ['nullable', 'string', 'max:512'],
            'credit' => ['nullable', 'string', 'max:160'],
            // Read by the browser from the video before it is sent; the host
            // cannot run a probe of its own.
            'duration_seconds' => ['nullable', 'integer', 'min:0', 'max:86400'],
        ]);

        try {
            // Anything over the host's 2 MB request limit - every video - arrives in parts first.
            $file = $uploads->fileFrom($request, 'file', self::MAX_VIDEO_KB);
            $isVideo = $file instanceof UploadedFile && in_array($file->getMimeType(), self::VIDEO, true);

            Validator::make(['file' => $file], [
                'file' => [
                    'required',
                    'file',
                    'max:'.($isVideo ? self::MAX_VIDEO_KB : self::MAX_FILE_KB),
                    'mimetypes:'.implode(',', [...self::ALLOWED, ...self::VIDEO]),
                ],
            ])->validate();

            $path = $file->store('uploads/'.now()->format('Y/m'), 'public');
            $dimensions = $isVideo ? [null, null] : (@getimagesize($file->getRealPath()) ?: [null, null]);
            $originalName = mb_substr($file->getClientOriginalName(), 0, 255);

            $media = Media::create([
                'uploaded_by' => $request->user()->getKey(),
                'disk' => 'public',
                'path' => $path,
                'original_name' => $originalName,
                // As WordPress does: the file's own name until someone writes a better one.
                'title' => $details['title'] ?? mb_substr(pathinfo($originalName, PATHINFO_FILENAME), 0, 255),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'width' => $dimensions[0] ?: null,
                'height' => $dimensions[1] ?: null,
                'duration_seconds' => $isVideo ? ($details['duration_seconds'] ?? null) : null,
                'checksum_sha256' => hash_file('sha256', $file->getRealPath()),
                'alt_text' => $details['alt_text'] ?? null,
                'caption' => $details['caption'] ?? null,
                'credit' => $details['credit'] ?? null,
            ]);
        } finally {
            $uploads->forgetFrom($request);
        }

        Audit::record('media.uploaded', $media, ['mime' => $media->mime_type]);

        return response()->json(['data' => $this->present($media)], 201);
    }

    public function update(Request $request, Media $medium): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'alt_text' => ['sometimes', 'nullable', 'string', 'max:255'],
            'caption' => ['sometimes', 'nullable', 'string', 'max:512'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'credit' => ['sometimes', 'nullable', 'string', 'max:160'],
            'exclude_from_sitemap' => ['sometimes', 'boolean'],
            'focal_x' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'focal_y' => ['sometimes', 'numeric', 'min:0', 'max:1'],
        ]);

        $medium->update($validated);
        $this->refreshPages($medium);

        return response()->json(['data' => $this->present($medium->fresh())]);
    }

    /** Flips, rotates, crops or scales an image in place. See ImageEditor. */
    public function edit(Request $request, Media $medium, ImageEditor $editor, MediaUsage $usage): JsonResponse
    {
        $this->guard($request);

        $edit = $request->validate([
            'rotate' => ['required', Rule::in([0, 90, 180, 270])],
            'flip_horizontal' => ['sometimes', 'boolean'],
            'flip_vertical' => ['sometimes', 'boolean'],
            'crop' => ['nullable', 'array'],
            'crop.x' => ['required_with:crop', 'integer', 'min:0'],
            'crop.y' => ['required_with:crop', 'integer', 'min:0'],
            'crop.width' => ['required_with:crop', 'integer', 'min:1'],
            'crop.height' => ['required_with:crop', 'integer', 'min:1'],
            'scale_width' => ['nullable', 'integer', 'min:1', 'max:20000'],
        ]);

        $editor->apply($medium, $edit);

        Audit::record('media.edited', $medium, Arr::only($edit, ['rotate', 'flip_horizontal', 'flip_vertical', 'crop', 'scale_width']));
        $this->refreshPages($medium);

        return response()->json(['data' => $this->detail($medium->fresh(), $usage)]);
    }

    public function restore(Request $request, Media $medium, ImageEditor $editor, MediaUsage $usage): JsonResponse
    {
        $this->guard($request);

        $editor->restore($medium);

        Audit::record('media.restored', $medium);
        $this->refreshPages($medium);

        return response()->json(['data' => $this->detail($medium->fresh(), $usage)]);
    }

    /**
     * A file still in use is refused, naming where, until the admin confirms
     * with `force`: deleting it empties those covers and breaks those images.
     */
    public function destroy(Request $request, Media $medium, MediaUsage $usage): JsonResponse
    {
        $this->guard($request);

        if (! $request->boolean('force')) {
            $places = $usage->placesFor($medium);

            if ($places !== []) {
                throw DomainException::conflict('This file is still used by: '.implode('; ', $places).'.');
            }
        }

        Storage::disk($medium->disk)->delete(array_filter([$medium->path, $medium->original_path]));
        Audit::record('media.deleted', $medium, ['path' => $medium->path]);
        $medium->delete();
        $this->refreshPages($medium);

        return response()->json(['message' => 'Media deleted.']);
    }

    private function guard(Request $request): void
    {
        abort_unless($request->user()->hasPermission('media.manage'), 403);
    }

    /** The attachment page and the sitemap that lists it. */
    private function refreshPages(Media $media): void
    {
        app(RevalidationService::class)->revalidate(['media:'.$media->getKey(), 'sitemap']);
    }

    private function detail(Media $media, MediaUsage $usage): array
    {
        $uses = $usage->usesOf($media);

        return $this->present($media) + [
            'used_in' => array_map(fn (array $use) => Arr::only($use, ['label', 'title', 'edit_path']), $uses),
            'shared_as_social_image' => $usage->sharedAsSocialImage($media),
            'focus_keywords' => $usage->focusKeywordsFor($uses),
        ];
    }

    private function present(Media $media): array
    {
        $uploader = $media->uploader;

        return [
            'id' => $media->id,
            'url' => $media->url(),
            'original_name' => $media->original_name,
            'title' => $media->title,
            'mime_type' => $media->mime_type,
            'size_bytes' => $media->size_bytes,
            'width' => $media->width,
            'height' => $media->height,
            'duration_seconds' => $media->duration_seconds,
            'alt_text' => $media->alt_text,
            'caption' => $media->caption,
            'description' => $media->description,
            'credit' => $media->credit,
            'focal' => ['x' => $media->focal_x, 'y' => $media->focal_y],
            'exclude_from_sitemap' => (bool) $media->exclude_from_sitemap,
            'editable' => ImageEditor::canEdit($media),
            'edited' => $media->original_path !== null,
            'attachment_path' => $media->disk === 'public' ? '/attachment/'.$media->id : null,
            'uploaded_by' => $uploader ? ['id' => $uploader->id, 'name' => $uploader->name] : null,
            'uploaded_at' => $media->created_at?->toIso8601String(),
        ];
    }
}
