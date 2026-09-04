<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Http\Resources\CourseSummaryResource;
use App\Http\Resources\LessonResource;
use App\Models\Course;
use App\Models\Lesson;
use App\Support\CourseTracks;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class CourseController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'level' => ['sometimes', 'string', 'in:beginner,intermediate,advanced'],
            'track' => ['sometimes', 'string', Rule::in(CourseTracks::slugs())],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $courses = Course::query()
            ->published()
            ->withCount('lessons')
            ->with(['cover', 'purchasableVariants.prices'])
            ->when($validated['level'] ?? null, fn ($query, $level) => $query->where('level', $level))
            ->when($validated['track'] ?? null, fn ($query, $track) => $query->where('track', $track))
            ->orderByDesc('published_at')
            ->paginate($validated['per_page'] ?? 12)
            ->withQueryString();

        return CourseSummaryResource::collection($courses);
    }

    public function show(string $slug): CourseResource
    {
        $course = Course::query()
            ->published()
            ->where('slug', $slug)
            ->withCount('lessons')
            ->with([
                'cover',
                'seo.ogImage',
                'sections.lessons',
                'instructors.author.photo',
                'instructors.user',
                'purchasableVariants.prices',
                'reviews' => fn ($query) => $query->published()->with('user')->latest('published_at')->limit(20),
            ])
            ->firstOrFail();

        return new CourseResource($course);
    }

    /**
     * A free preview lesson is the only lesson body this endpoint will return.
     * Everything else goes through the authenticated learn API.
     */
    public function preview(string $courseSlug, string $lessonSlug): LessonResource
    {
        $course = Course::query()->published()->where('slug', $courseSlug)->firstOrFail();

        $lesson = Lesson::query()
            ->where('course_id', $course->getKey())
            ->where('slug', $lessonSlug)
            ->where('is_free_preview', true)
            ->with(['course', 'assets'])
            ->firstOrFail();

        return new LessonResource($lesson);
    }
}
