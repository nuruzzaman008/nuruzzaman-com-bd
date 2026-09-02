<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourseReviewResource;
use App\Jobs\RevalidateFrontend;
use App\Models\CourseReview;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Reviews are held until a moderator approves them. Nothing here can create a
 * review: only a learner with a verified enrolment can do that.
 */
class ReviewModerationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->guard($request);

        $validated = $request->validate([
            'status' => ['sometimes', 'string', 'in:'.implode(',', ContentStatus::values())],
        ]);

        $reviews = CourseReview::query()
            ->with(['user:id,name', 'course:id,slug,title'])
            ->where('status', $validated['status'] ?? ContentStatus::InReview->value)
            ->latest('id')
            ->paginate(50);

        return CourseReviewResource::collection($reviews);
    }

    public function moderate(Request $request, CourseReview $review): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:published,archived,draft'],
        ]);

        $status = ContentStatus::from($validated['status']);

        $review->update([
            'status' => $status,
            'published_at' => $status === ContentStatus::Published ? now() : null,
        ]);

        Audit::record('course_review.moderated', $review, ['status' => $status->value]);
        RevalidateFrontend::dispatch(['course:'.$review->course->slug]);

        return response()->json(['data' => new CourseReviewResource($review->fresh()->load('user'))]);
    }

    private function guard(Request $request): void
    {
        abort_unless($request->user()->hasPermission('courses.manage'), 403);
    }
}
