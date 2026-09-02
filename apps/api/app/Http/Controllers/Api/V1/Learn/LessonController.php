<?php

namespace App\Http\Controllers\Api\V1\Learn;

use App\Http\Controllers\Controller;
use App\Http\Resources\LessonResource;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Services\Lms\EnrollmentService;
use App\Services\Video\VideoPlaybackService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The authenticated course player API. Every read here is authorised against
 * the enrolment in the database; nothing relies on the frontend hiding a route.
 */
class LessonController extends Controller
{
    public function __construct(
        private readonly EnrollmentService $enrollments,
        private readonly VideoPlaybackService $video,
    ) {}

    /** Curriculum plus this learner's own unlock and completion state. */
    public function outline(Request $request, string $courseSlug): JsonResponse
    {
        $course = Course::query()->where('slug', $courseSlug)->firstOrFail();

        /** @var Enrollment $enrollment */
        $enrollment = Enrollment::query()
            ->where('user_id', $request->user()->getKey())
            ->where('course_id', $course->getKey())
            ->firstOrFail();

        $this->authorize('learn', $enrollment);

        $course->load(['sections.lessons']);
        $completed = $enrollment->progress()->where('is_completed', true)->pluck('lesson_id')->all();

        return response()->json([
            'data' => [
                'course' => [
                    'slug' => $course->slug,
                    'title' => $course->title,
                    'sequential' => (bool) $course->sequential,
                    'issues_certificate' => (bool) $course->issues_certificate,
                ],
                'enrollment' => [
                    'status' => $enrollment->status->value,
                    'progress_percent' => (int) $enrollment->progress_percent,
                    'expires_at' => $enrollment->expires_at?->toIso8601String(),
                    'last_lesson_id' => $enrollment->last_lesson_id,
                ],
                'sections' => $course->sections->map(fn ($section) => [
                    'id' => $section->id,
                    'title' => $section->title,
                    'lessons' => $section->lessons->map(fn (Lesson $lesson) => [
                        'slug' => $lesson->slug,
                        'title' => $lesson->title,
                        'type' => $lesson->type->value,
                        'duration_seconds' => $lesson->duration_seconds,
                        'is_completed' => in_array($lesson->getKey(), $completed, true),
                        'is_unlocked' => $this->enrollments->isUnlocked($enrollment, $lesson),
                    ])->values(),
                ])->values(),
            ],
        ]);
    }

    public function show(Request $request, string $courseSlug, string $lessonSlug): LessonResource
    {
        $course = Course::query()->where('slug', $courseSlug)->firstOrFail();

        $lesson = Lesson::query()
            ->where('course_id', $course->getKey())
            ->where('slug', $lessonSlug)
            ->with(['course', 'assets', 'quiz', 'assignment'])
            ->firstOrFail();

        $this->enrollments->assertAccess($request->user(), $lesson);

        return new LessonResource($lesson, $this->video->playbackFor($lesson));
    }
}
