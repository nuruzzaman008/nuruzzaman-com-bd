<?php

namespace App\Http\Controllers\Api\V1\Learn;

use App\Http\Controllers\Controller;
use App\Http\Resources\LessonNoteResource;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Private study notes.
 *
 * Every query is scoped to the caller's own enrolment, so one learner can never
 * read or delete another's notes even by guessing an id.
 */
class NoteController extends Controller
{
    public function index(Request $request, string $courseSlug): AnonymousResourceCollection
    {
        $enrollment = $this->enrollment($request, $courseSlug);

        $notes = $enrollment->notes()
            ->with('lesson:id,slug,title')
            ->orderByDesc('created_at')
            ->paginate(50);

        return LessonNoteResource::collection($notes);
    }

    public function store(Request $request, string $courseSlug, string $lessonSlug): LessonNoteResource
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'position_seconds' => ['nullable', 'integer', 'min:0', 'max:86400'],
        ]);

        $enrollment = $this->enrollment($request, $courseSlug);

        /** @var Lesson $lesson */
        $lesson = Lesson::query()
            ->where('course_id', $enrollment->course_id)
            ->where('slug', $lessonSlug)
            ->firstOrFail();

        $note = LessonNote::query()->create([
            'enrollment_id' => $enrollment->getKey(),
            'lesson_id' => $lesson->getKey(),
            'user_id' => $request->user()->getKey(),
            'body' => $validated['body'],
            'position_seconds' => $validated['position_seconds'] ?? null,
        ]);

        return new LessonNoteResource($note->load('lesson:id,slug,title'));
    }

    public function destroy(Request $request, string $courseSlug, int $noteId): JsonResponse
    {
        $enrollment = $this->enrollment($request, $courseSlug);

        $enrollment->notes()->whereKey($noteId)->firstOrFail()->delete();

        return response()->json(status: 204);
    }

    private function enrollment(Request $request, string $courseSlug): Enrollment
    {
        $course = Course::query()->where('slug', $courseSlug)->firstOrFail();

        /** @var Enrollment $enrollment */
        $enrollment = Enrollment::query()
            ->where('user_id', $request->user()->getKey())
            ->where('course_id', $course->getKey())
            ->firstOrFail();

        $this->authorize('view', $enrollment);

        return $enrollment;
    }
}
