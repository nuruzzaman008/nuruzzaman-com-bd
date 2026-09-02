<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourseQuestionResource;
use App\Models\Course;
use App\Models\CourseQuestion;
use App\Support\Audit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Moderates the course Q&A. Questions default to `in_review`, so this is what
 * makes one visible to the rest of the class.
 */
class QuestionModerationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Course::class);

        $questions = CourseQuestion::query()
            ->when(
                $request->string('status')->isNotEmpty(),
                fn ($query) => $query->where('status', $request->string('status')),
                fn ($query) => $query->where('status', ContentStatus::InReview->value),
            )
            ->with(['user', 'lesson', 'course', 'replies.user'])
            ->orderBy('created_at')
            ->paginate(50);

        return CourseQuestionResource::collection($questions);
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

        return new CourseQuestionResource($question->fresh()->load(['user', 'lesson', 'replies.user']));
    }
}
