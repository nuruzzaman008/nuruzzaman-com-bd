<?php

namespace App\Http\Controllers\Api\V1\Learn;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourseReviewResource;
use App\Models\Course;
use App\Models\CourseReview;
use App\Models\Enrollment;
use Illuminate\Http\Request;

/**
 * Only a learner with a real enrolment can leave a review, and it is held for
 * moderation before it appears publicly.
 */
class CourseReviewController extends Controller
{
    public function store(Request $request, string $courseSlug): CourseReviewResource
    {
        $validated = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:200'],
            'body' => ['nullable', 'string', 'max:3000'],
        ]);

        $course = Course::query()->where('slug', $courseSlug)->firstOrFail();

        /** @var Enrollment $enrollment */
        $enrollment = Enrollment::query()
            ->where('user_id', $request->user()->getKey())
            ->where('course_id', $course->getKey())
            ->firstOrFail();

        $this->authorize('view', $enrollment);

        $review = CourseReview::query()->updateOrCreate(
            ['course_id' => $course->getKey(), 'user_id' => $request->user()->getKey()],
            [
                'enrollment_id' => $enrollment->getKey(),
                'rating' => $validated['rating'],
                'title' => $validated['title'] ?? null,
                'body' => $validated['body'] ?? null,
                'status' => ContentStatus::InReview,
                'published_at' => null,
            ],
        );

        return new CourseReviewResource($review->load('user'));
    }
}
