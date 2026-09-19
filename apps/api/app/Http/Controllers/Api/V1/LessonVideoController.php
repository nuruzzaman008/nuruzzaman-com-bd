<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\User;
use App\Services\Lms\EnrollmentService;
use App\Services\Uploads\ChunkedUploads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class LessonVideoController extends Controller
{
    public function upload(Request $request, Course $course, Lesson $lesson, ChunkedUploads $uploads): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id, 404);

        try {
            // Every lesson video is over the host's per-request limit, so it
            // normally arrives in parts first.
            $video = $uploads->fileFrom($request, 'video', 102400);
            Validator::make(
                ['video' => $video],
                ['video' => ['required', 'file', 'max:102400', 'mimes:mp4,webm', 'extensions:mp4,webm']],
            )->validate();
            $path = $video->store('lesson-videos/'.$lesson->id, 'private');
        } finally {
            $uploads->forgetFrom($request);
        }

        try {
            $lesson->update(['type' => 'video', 'video_provider' => 'uploaded', 'video_asset_id' => $path, 'video_url' => null]);
        } catch (\Throwable $error) {
            Storage::disk('private')->delete($path);
            throw $error;
        }

        return response()->json(['data' => ['uploaded' => true]], 201);
    }

    public function stream(Request $request, Lesson $lesson, EnrollmentService $enrollments): BinaryFileResponse
    {
        abort_unless($request->hasValidRelativeSignature(), 403);
        $lesson->load(['course', 'section']);
        if ((int) $request->query('viewer') > 0) {
            $user = User::findOrFail((int) $request->query('viewer'));
            $enrollments->assertAccess($user, $lesson);
        } else {
            abort_unless($lesson->is_free_preview && $lesson->course->status->value === 'published', 403);
        }
        if ($request->has('asset')) {
            $asset = $lesson->assets()->findOrFail($request->integer('asset'));
            $mime = $asset->playableVideoMime();
            abort_unless($mime && config('filesystems.disks.'.$asset->disk.'.driver') === 'local', 404);
            $disk = Storage::disk($asset->disk);
            abort_unless(str_starts_with($asset->storage_path, 'lessons/'.$lesson->id.'/') && ! str_contains($asset->storage_path, '..') && $disk->exists($asset->storage_path), 404);

            return response()->file($disk->path($asset->storage_path), ['Content-Type' => $mime, 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
        }
        abort_unless($lesson->video_provider === 'uploaded' && str_starts_with((string) $lesson->video_asset_id, 'lesson-videos/'.$lesson->id.'/') && ! str_contains($lesson->video_asset_id, '..'), 404);
        $disk = Storage::disk('private');
        abort_unless($disk->exists($lesson->video_asset_id), 404);

        return response()->file($disk->path($lesson->video_asset_id), ['Content-Type' => str_ends_with($lesson->video_asset_id, '.webm') ? 'video/webm' : 'video/mp4', 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}
