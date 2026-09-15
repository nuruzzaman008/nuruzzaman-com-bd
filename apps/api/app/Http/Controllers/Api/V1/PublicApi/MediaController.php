<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Models\Media;
use Illuminate\Http\JsonResponse;

class MediaController extends Controller
{
    /**
     * An attachment page: one public file with its title, caption and
     * description. Files kept on a private disk have no page.
     */
    public function show(Media $medium): JsonResponse
    {
        abort_unless($medium->disk === 'public', 404);

        return response()->json([
            'data' => [
                'id' => $medium->id,
                'url' => $medium->url(),
                'title' => $medium->title ?: pathinfo($medium->original_name, PATHINFO_FILENAME),
                'original_name' => $medium->original_name,
                'mime_type' => $medium->mime_type,
                'size_bytes' => $medium->size_bytes,
                'width' => $medium->width,
                'height' => $medium->height,
                'duration_seconds' => $medium->duration_seconds,
                'alt_text' => $medium->alt_text,
                'caption' => $medium->caption,
                'description' => $medium->description,
                'exclude_from_sitemap' => (bool) $medium->exclude_from_sitemap,
                'uploaded_at' => $medium->created_at?->toIso8601String(),
                'updated_at' => $medium->updated_at?->toIso8601String(),
            ],
        ]);
    }
}
