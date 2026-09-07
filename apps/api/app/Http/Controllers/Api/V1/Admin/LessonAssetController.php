<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class LessonAssetController extends Controller
{
    public function store(Request $request, Course $course, Lesson $lesson): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id, 404);
        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'file' => ['required', 'file', 'max:102400', 'extensions:pdf,zip,doc,docx,xls,xlsx,ppt,pptx,txt,csv,png,jpg,jpeg,dwg,dxf'],
        ]);
        $file = $request->file('file');
        $disk = config('nb.downloads.disk', 'private');
        $path = $file->store('lessons/'.$lesson->id, $disk);
        try {
            $asset = $lesson->assets()->create([
                'title' => ($validated['title'] ?? null) ?: mb_substr($file->getClientOriginalName(), 0, 255),
                'disk' => $disk,
                'storage_path' => $path,
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'checksum_sha256' => hash_file('sha256', $file->getRealPath()),
                'position' => ($lesson->assets()->max('position') ?? -1) + 1,
            ]);
        } catch (\Throwable $error) {
            Storage::disk($disk)->delete($path);
            throw $error;
        }
        return response()->json(['data' => $asset], 201);
    }

    public function destroy(Course $course, Lesson $lesson, LessonAsset $asset): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id && $asset->lesson_id === $lesson->id, 404);
        Storage::disk($asset->disk)->delete($asset->storage_path);
        $asset->delete();
        return response()->json(['message' => 'File deleted.']);
    }
}
