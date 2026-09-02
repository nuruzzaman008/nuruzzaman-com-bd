<?php

namespace App\Http\Controllers\Api\V1\Learn;

use App\Http\Controllers\Controller;
use App\Http\Resources\EnrollmentResource;
use App\Models\Course;
use App\Models\Lesson;
use App\Services\Lms\EnrollmentService;
use App\Services\Lms\ProgressService;
use Illuminate\Http\Request;

class ProgressController extends Controller
{
    public function __construct(
        private readonly EnrollmentService $enrollments,
        private readonly ProgressService $progress,
    ) {}

    /**
     * Records how far into a lesson the learner has reached. The client cannot
     * send a course percentage - that is always derived from completions.
     */
    public function heartbeat(Request $request, string $courseSlug, string $lessonSlug): EnrollmentResource
    {
        $validated = $request->validate([
            'watched_seconds' => ['required', 'integer', 'min:0', 'max:86400'],
        ]);

        [$enrollment, $lesson] = $this->resolve($request, $courseSlug, $lessonSlug);

        $this->progress->markSeen($enrollment, $lesson, $validated['watched_seconds']);

        return new EnrollmentResource($enrollment->fresh()->load('course'));
    }

    /** Idempotent: repeating a completion changes nothing. */
    public function complete(Request $request, string $courseSlug, string $lessonSlug): EnrollmentResource
    {
        [$enrollment, $lesson] = $this->resolve($request, $courseSlug, $lessonSlug);

        $this->progress->complete($enrollment, $lesson);

        return new EnrollmentResource($enrollment->fresh()->load(['course', 'certificate']));
    }

    /** @return array{0: \App\Models\Enrollment, 1: Lesson} */
    private function resolve(Request $request, string $courseSlug, string $lessonSlug): array
    {
        $course = Course::query()->where('slug', $courseSlug)->firstOrFail();

        $lesson = Lesson::query()
            ->where('course_id', $course->getKey())
            ->where('slug', $lessonSlug)
            ->firstOrFail();

        return [$this->enrollments->assertAccess($request->user(), $lesson), $lesson];
    }
}
