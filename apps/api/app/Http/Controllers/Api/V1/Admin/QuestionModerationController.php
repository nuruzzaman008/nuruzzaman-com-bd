<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourseQuestionResource;
use App\Mail\QuestionAnsweredMail;
use App\Models\Course;
use App\Models\CourseQuestion;
use App\Models\CourseQuestionReply;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Mail;

/**
 * The course Q&A from the teaching side: Dashboard -> Student questions.
 *
 * A question starts private - its author and the teaching team see it - and
 * stays so unless it is published, which shows it and its answers to the
 * whole class. Replies come from here, so answering does not need the staff
 * member to be enrolled in the course.
 */
class QuestionModerationController extends Controller
{
    /**
     * `status`: in_review (private), published (shown to the class),
     * archived (hidden), or all (everything not hidden). Without one, the
     * private questions, as before. `answered`: yes or no.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Course::class);

        $status = $request->string('status')->toString();
        $answered = $request->filled('answered') ? $request->boolean('answered') : null;

        $questions = CourseQuestion::query()
            ->when(
                $status === 'all',
                fn ($query) => $query->where('status', '!=', ContentStatus::Archived->value),
                fn ($query) => $query->where('status', $status !== '' ? $status : ContentStatus::InReview->value),
            )
            ->when($answered === true, fn ($query) => $query->whereNotNull('answered_at'))
            ->when($answered === false, fn ($query) => $query->whereNull('answered_at'))
            ->with(['user', 'lesson', 'course', 'replies.user'])
            // Waiting longest first; answered ones most recent first.
            ->when(
                $answered === true,
                fn ($query) => $query->orderByDesc('answered_at'),
                fn ($query) => $query->orderBy('created_at'),
            )
            ->paginate(50);

        return CourseQuestionResource::collection($questions);
    }

    /** For the badge beside "Student questions" in the dashboard menu. */
    public function unansweredCount(): JsonResponse
    {
        $this->authorize('viewAny', Course::class);

        return response()->json(['data' => [
            'count' => CourseQuestion::query()
                ->whereNull('answered_at')
                ->where('status', '!=', ContentStatus::Archived->value)
                ->count(),
        ]]);
    }

    /**
     * Answers a question as the teaching team. Whoever may edit the course -
     * super admins, admins, its instructors - may answer, and the student is
     * told by email.
     */
    public function reply(Request $request, CourseQuestion $question): CourseQuestionResource
    {
        $this->authorize('update', $question->course);

        $validated = $request->validate(['body' => ['required', 'string', 'max:5000']]);
        $staff = $request->user();

        CourseQuestionReply::query()->create([
            'course_question_id' => $question->getKey(),
            'user_id' => $staff->getKey(),
            'body' => $validated['body'],
            'from_instructor' => true,
            'status' => ContentStatus::Published,
        ]);

        $question->forceFill([
            'reply_count' => $question->replies()->count(),
            'answered_at' => $question->answered_at ?? now(),
        ])->save();

        Audit::record('course.question.replied', $question, [], $staff->getKey());

        $question->loadMissing(['user', 'course', 'lesson']);

        if ($question->user && $question->user_id !== $staff->getKey()) {
            Mail::to($question->user->email)->queue(new QuestionAnsweredMail($question, $staff->name, $validated['body']));
        }

        return new CourseQuestionResource($question->fresh()->load(['user', 'lesson', 'course', 'replies.user']));
    }

    public function moderate(Request $request, CourseQuestion $question): CourseQuestionResource
    {
        $this->authorize('update', $question->course);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:published,archived,in_review'],
            'is_pinned' => ['sometimes', 'boolean'],
            'resolved' => ['sometimes', 'boolean'],
        ]);

        $question->update([
            'status' => ContentStatus::from($validated['status']),
            'is_pinned' => $validated['is_pinned'] ?? $question->is_pinned,
            'resolved_at' => array_key_exists('resolved', $validated)
                ? ($validated['resolved'] ? now() : null)
                : $question->resolved_at,
        ]);

        Audit::record('course.question.moderated', $question, [
            'status' => $validated['status'],
        ]);

        return new CourseQuestionResource($question->fresh()->load(['user', 'lesson', 'course', 'replies.user']));
    }
}
