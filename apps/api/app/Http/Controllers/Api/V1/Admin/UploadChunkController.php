<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Uploads\ChunkedUploads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * One part of a large upload. What the parts become is decided, and
 * authorised, by the endpoint they are later attached through; until then they
 * sit in the sender's own private space. See ChunkedUploads.
 */
class UploadChunkController extends Controller
{
    public function __construct(private readonly ChunkedUploads $uploads) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'upload_id' => ['required', 'uuid'],
            'index' => ['required', 'integer', 'min:0', 'max:'.(ChunkedUploads::MAX_PARTS - 1)],
            'chunk' => ['required', 'file', 'max:'.ChunkedUploads::MAX_PART_KB],
        ]);

        $index = (int) $validated['index'];

        $this->uploads->put($request->user(), strtolower($validated['upload_id']), $index, $request->file('chunk'));

        return response()->json(['data' => ['received' => $index]], 201);
    }
}
