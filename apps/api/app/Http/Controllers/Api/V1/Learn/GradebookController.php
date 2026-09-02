<?php

namespace App\Http\Controllers\Api\V1\Learn;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Services\Lms\GradebookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The learner's own marks for one course. */
class GradebookController extends Controller
{
    public function __construct(private readonly GradebookService $gradebook)
    {
    }

    public function show(Request $request, string $courseSlug): JsonResponse
    {
        $course = Course::query()->where('slug', $courseSlug)->firstOrFail();

        /** @var Enrollment $enrollment */
        $enrollment = Enrollment::query()
            ->where('user_id', $request->user()->getKey())
            ->where('course_id', $course->getKey())
            ->firstOrFail();

        $this->authorize('view', $enrollment);

        return response()->json(['data' => $this->gradebook->for($enrollment)]);
    }
}
