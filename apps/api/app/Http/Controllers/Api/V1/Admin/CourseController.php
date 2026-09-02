<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use App\Services\Content\PublishingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class CourseController extends Controller
{
    public function __construct(private readonly PublishingService $publishing) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Course::class);

        $courses = Course::query()->withCount('lessons')->orderBy('title')->paginate(50);

        return CourseResource::collection($courses);
    }

    public function show(Course $course): CourseResource
    {
        $this->authorize('view', $course);

        return new CourseResource($course->loadCount('lessons')->load([
            'sections.lessons', 'instructors.user', 'instructors.author', 'seo',
        ]));
    }

    public function store(Request $request): CourseResource
    {
        $this->authorize('create', Course::class);

        $course = Course::create($request->validate($this->rules(null)) + ['status' => ContentStatus::Draft]);

        return new CourseResource($course->loadCount('lessons'));
    }

    public function update(Request $request, Course $course): CourseResource
    {
        $this->authorize('update', $course);

        $course->update($request->validate($this->rules($course->getKey())));

        return new CourseResource($course->fresh()->loadCount('lessons'));
    }

    /**
     * A course cannot be published until it has at least one real lesson, so an
     * empty placeholder can never reach the sitemap.
     */
    public function transition(Request $request, Course $course): CourseResource
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', ContentStatus::values())],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $target = ContentStatus::from($validated['status']);
        $this->authorize($target === ContentStatus::Published ? 'publish' : 'update', $course);

        if ($target === ContentStatus::Published && $course->lessons()->count() === 0) {
            abort(422, 'Add at least one lesson before publishing this course.');
        }

        $this->publishing->transition($course, $target, $request->user(), $validated['note'] ?? null);

        return new CourseResource($course->fresh()->loadCount('lessons'));
    }

    public function syncInstructors(Request $request, Course $course): JsonResponse
    {
        $this->authorize('update', $course);

        $validated = $request->validate([
            'instructors' => ['present', 'array', 'max:6'],
            'instructors.*.user_id' => ['required', 'integer', 'exists:users,id'],
            'instructors.*.author_id' => ['nullable', 'integer', 'exists:authors,id'],
            'instructors.*.role' => ['sometimes', 'string', 'in:instructor,assistant,reviewer'],
        ]);

        $course->instructors()->delete();

        foreach ($validated['instructors'] as $index => $row) {
            $course->instructors()->create($row + ['position' => $index]);
        }

        return response()->json(['data' => $course->fresh()->load('instructors.user')->instructors]);
    }

    private function rules(?int $courseId): array
    {
        return [
            'slug' => [
                $courseId ? 'sometimes' : 'required',
                'string', 'max:180', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('courses', 'slug')->ignore($courseId),
            ],
            'title' => [$courseId ? 'sometimes' : 'required', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'description_markdown' => ['nullable', 'string', 'max:200000'],
            'level' => ['sometimes', 'string', 'in:beginner,intermediate,advanced'],
            'language' => ['sometimes', 'string', 'max:32'],
            'cover_media_id' => ['nullable', 'integer', 'exists:media,id'],
            'outcomes' => ['sometimes', 'array', 'max:12'],
            'outcomes.*' => ['string', 'max:255'],
            'audience' => ['sometimes', 'array', 'max:12'],
            'audience.*' => ['string', 'max:255'],
            'prerequisites' => ['sometimes', 'array', 'max:12'],
            'prerequisites.*' => ['string', 'max:255'],
            'required_software' => ['sometimes', 'array', 'max:12'],
            'required_software.*' => ['string', 'max:255'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1'],
            'access_duration_days' => ['nullable', 'integer', 'min:1'],
            'sequential' => ['sometimes', 'boolean'],
            'pass_percentage' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'issues_certificate' => ['sometimes', 'boolean'],
            'support_policy' => ['nullable', 'string', 'max:512'],
            'refund_policy' => ['nullable', 'string', 'max:512'],
            'last_reviewed_at' => ['nullable', 'date'],
        ];
    }
}
