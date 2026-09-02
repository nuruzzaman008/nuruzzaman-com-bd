<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\EnrollmentResource;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Services\Lms\EnrollmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EnrollmentController extends Controller
{
    public function __construct(private readonly EnrollmentService $enrollments) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('manage', Enrollment::class);

        $validated = $request->validate([
            'course' => ['sometimes', 'string', 'max:180'],
            'status' => ['sometimes', 'string', 'in:active,completed,expired,revoked'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $enrollments = Enrollment::query()
            ->with(['course', 'user:id,name,email'])
            ->when($validated['course'] ?? null, fn ($query, $slug) => $query
                ->whereHas('course', fn ($inner) => $inner->where('slug', $slug)))
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->latest('id')
            ->paginate($validated['per_page'] ?? 25);

        return EnrollmentResource::collection($enrollments);
    }

    /** Manual grant, for example after an offline or bank-transfer purchase. */
    public function store(Request $request): EnrollmentResource
    {
        $this->authorize('manage', Enrollment::class);

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'course_slug' => ['required', 'string', 'exists:courses,slug'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $enrollment = $this->enrollments->enroll(
            User::findOrFail($validated['user_id']),
            Course::query()->where('slug', $validated['course_slug'])->firstOrFail(),
            null,
            'manual',
        );

        return new EnrollmentResource($enrollment->load('course'));
    }

    public function revoke(Request $request, Enrollment $enrollment): JsonResponse
    {
        $this->authorize('manage', Enrollment::class);

        $validated = $request->validate(['reason' => ['required', 'string', 'max:255']]);

        $this->enrollments->revoke($enrollment, $validated['reason']);

        return response()->json(['message' => 'Enrolment revoked.']);
    }
}
