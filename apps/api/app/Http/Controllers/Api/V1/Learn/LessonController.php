<?php

namespace App\Http\Controllers\Api\V1\Learn;

use App\Http\Controllers\Controller;
use App\Http\Resources\LessonResource;
use App\Models\Certificate;
use App\Models\Course;
use App\Models\CourseReview;
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
    public function download(Request $request, string $courseSlug, string $lessonSlug, int $assetId): \Symfony\Component\HttpFoundation\Response
    {
        $course = Course::query()->where('slug', $courseSlug)->firstOrFail();
        $lesson = $course->lessons()->where('slug', $lessonSlug)->with('section')->firstOrFail();
        $this->enrollments->assertAccess($request->user(), $lesson);
        $asset = $lesson->assets()->findOrFail($assetId);

        // A linked document opens where it lives - Google Drive, Dropbox - but
        // only after the same enrolment check a stored file gets.
        if ($asset->isLink()) {
            return redirect()->away($asset->storage_path);
        }

        $disk = \Illuminate\Support\Facades\Storage::disk($asset->disk);
        abort_unless($disk->exists($asset->storage_path), 404);
        $extension = pathinfo($asset->storage_path, PATHINFO_EXTENSION);
        $name = preg_replace('/[\\\\\/\r\n\x00-\x1f]/u', '-', $asset->title);
        if ($extension && ! str_ends_with(strtolower($name), '.'.strtolower($extension))) {
            $name .= '.'.$extension;
        }
        return $disk->download($asset->storage_path, $name, [
            'Content-Type' => 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

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

        // What each lesson holds, so the player's list can say so without
        // loading every lesson: a video, how many files, a quiz or assignment.
        $course->load(['sections.lessons' => fn ($query) => $query
            ->withCount('assets')
            ->with(['quiz:id,lesson_id', 'assignment:id,lesson_id'])]);

        // isUnlocked() falls back to the section's drip window when the lesson
        // has none, and every lesson without its own drip_days would otherwise
        // lazy-load its section — which strict mode refuses, taking the whole
        // outline down. The section is already in memory here, so hand it over.
        $course->sections->each(
            fn ($section) => $section->lessons->each(
                fn (Lesson $lesson) => $lesson->setRelation('section', $section),
            ),
        );

        $completed = $enrollment->progress()->where('is_completed', true)->pluck('lesson_id')->all();

        $certificate = Certificate::query()
            ->where('user_id', $request->user()->getKey())
            ->where('course_id', $course->getKey())
            ->whereNull('revoked_at')
            ->latest('issued_at')
            ->first();

        $review = CourseReview::query()
            ->where('user_id', $request->user()->getKey())
            ->where('course_id', $course->getKey())
            ->first();

        return response()->json([
            'data' => [
                'course' => [
                    'slug' => $course->slug,
                    'title' => $course->title,
                    'sequential' => (bool) $course->sequential,
                    'issues_certificate' => (bool) $course->issues_certificate,
                ],
                'certificate' => $certificate ? [
                    'verification_id' => $certificate->verification_id,
                    'issued_at' => $certificate->issued_at?->toIso8601String(),
                ] : null,
                // The learner's own review, so the form opens on what they wrote.
                'review' => $review ? [
                    'rating' => (int) $review->rating,
                    'title' => $review->title,
                    'body' => $review->body,
                    'status' => $review->status instanceof \BackedEnum ? $review->status->value : (string) $review->status,
                ] : null,
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
                        'has_video' => filled($lesson->video_url) || filled($lesson->video_asset_id),
                        'assets_count' => (int) $lesson->assets_count,
                        'has_quiz' => $lesson->quiz !== null,
                        'has_assignment' => $lesson->assignment !== null,
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
            ->with(['course', 'section', 'assets', 'quiz', 'assignment'])
            ->firstOrFail();

        $this->enrollments->assertAccess($request->user(), $lesson);

        return new LessonResource($lesson, $this->video->playbackFor($lesson));
    }
}
