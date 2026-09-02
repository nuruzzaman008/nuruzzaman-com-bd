<?php

namespace App\Http\Controllers\Api\V1\Learn;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourseQuestionResource;
use App\Models\Course;
use App\Models\CourseQuestion;
use App\Models\CourseQuestionReply;
use App\Models\Enrollment;
use App\Models\Lesson;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Course Q&A.
 *
 * A question is visible to the class only after moderation, but its author
 * always sees their own while it waits, so the thread does not look like it
 * silently vanished.
 */
class QuestionController extends Controller
{
    public function index(Request $request, string $courseSlug): AnonymousResourceCollection
    {
        [$course, $enrollment] = $this->resolve($request, $courseSlug);

        $questions = CourseQuestion::query()
            ->where('course_id', $course->getKey())
            ->where(fn ($query) => $query
                ->where('status', ContentStatus::Published->value)
                ->orWhere('user_id', $request->user()->getKey()))
            ->when($request->string('lesson')->isNotEmpty(), fn ($query) => $query->whereHas(
                'lesson',
                fn ($lesson) => $lesson->where('slug', $request->string('lesson')),
            ))
            ->with(['user', 'lesson', 'replies.user'])
            ->orderByDesc('is_pinned')
            ->orderByDesc('created_at')
            ->paginate(20);

        return CourseQuestionResource::collection($questions);
    }

    public function store(Request $request, string $courseSlug): CourseQuestionResource
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:5000'],
            'lesson' => ['nullable', 'string', 'max:180'],
        ]);

        [$course, $enrollment] = $this->resolve($request, $courseSlug);

        $lesson = isset($validated['lesson'])
            ? Lesson::query()
                ->where('course_id', $course->getKey())
                ->where('slug', $validated['lesson'])
                ->first()
            : null;

        $question = CourseQuestion::query()->create([
            'course_id' => $course->getKey(),
            'lesson_id' => $lesson?->getKey(),
            'enrollment_id' => $enrollment->getKey(),
            'user_id' => $request->user()->getKey(),
            'title' => $validated['title'],
            'body' => $validated['body'],
            'status' => ContentStatus::InReview,
        ]);

        return new CourseQuestionResource($question->load(['user', 'lesson', 'replies.user']));
    }

    public function reply(Request $request, string $courseSlug, int $questionId): CourseQuestionResource
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        [$course] = $this->resolve($request, $courseSlug);

        /** @var CourseQuestion $question */
        $question = CourseQuestion::query()
            ->where('course_id', $course->getKey())
            ->findOrFail($questionId);

        // Only the thread's author and the teaching team may add to a question
        // that has not been published to the class yet.
        $isInstructor = $course->instructors()->where('user_id', $request->user()->getKey())->exists();
        $isAuthor = $question->user_id === $request->user()->getKey();

        abort_unless(
            $question->status === ContentStatus::Published || $isAuthor || $isInstructor,
            403,
            'This question is not open for replies.',
        );

        CourseQuestionReply::query()->create([
            'course_question_id' => $question->getKey(),
            'user_id' => $request->user()->getKey(),
            'body' => $validated['body'],
            // Recorded now so the badge survives a later change to the team.
            'from_instructor' => $isInstructor,
            'status' => ContentStatus::Published,
        ]);

        $question->forceFill([
            'reply_count' => $question->replies()->count(),
            'answered_at' => $isInstructor ? ($question->answered_at ?? now()) : $question->answered_at,
        ])->save();

        return new CourseQuestionResource($question->load(['user', 'lesson', 'replies.user']));
    }

    /** @return array{0: Course, 1: Enrollment} */
    private function resolve(Request $request, string $courseSlug): array
    {
        $course = Course::query()->where('slug', $courseSlug)->firstOrFail();

        /** @var Enrollment $enrollment */
        $enrollment = Enrollment::query()
            ->where('user_id', $request->user()->getKey())
            ->where('course_id', $course->getKey())
            ->firstOrFail();

        $this->authorize('view', $enrollment);

        return [$course, $enrollment];
    }
}
