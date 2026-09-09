<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\User;
use App\Services\Lms\EnrollmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class LessonVideoController extends Controller
{
    public function upload(Request $request, Course $course, Lesson $lesson): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id, 404);
        $request->validate(['video' => ['required', 'file', 'max:102400', 'mimes:mp4,webm', 'extensions:mp4,webm']]);
        $path = $request->file('video')->store('lesson-videos/'.$lesson->id, 'private');
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
        abort_unless($lesson->video_provider === 'uploaded' && str_starts_with((string) $lesson->video_asset_id, 'lesson-videos/'.$lesson->id.'/') && ! str_contains($lesson->video_asset_id, '..'), 404);
        $disk = Storage::disk('private');
        abort_unless($disk->exists($lesson->video_asset_id), 404);

        return response()->file($disk->path($lesson->video_asset_id), ['Content-Type' => str_ends_with($lesson->video_asset_id, '.webm') ? 'video/webm' : 'video/mp4', 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}
