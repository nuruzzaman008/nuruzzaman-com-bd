<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\LessonType;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseSection;
use App\Models\Lesson;
use App\Services\Lms\CoursePricingService;
use App\Support\LessonVideoUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CourseStructureController extends Controller
{
    public function price(Request $request, Course $course, CoursePricingService $pricing): JsonResponse
    {
        $this->authorize('update', $course);
        $input = $request->validate(['amount_minor' => ['required', 'integer', 'min:1', 'max:100000000']]);
        $pricing->set($course, $input['amount_minor']);

        return response()->json(['data' => ['saved' => true]]);
    }

    public function show(Course $course): JsonResponse
    {
        $this->authorize('update', $course);
        $course->load('sections.lessons.assets', 'seo');

        return response()->json(['data' => [
            'id' => $course->id, 'title' => $course->title, 'slug' => $course->slug,
            'status' => $course->status->value, 'sequential' => (bool) $course->sequential,
            'issues_certificate' => (bool) $course->issues_certificate,
            'description_markdown' => $course->description_markdown,
            'seo' => $course->seo?->only(['meta_title', 'meta_title_en', 'meta_description', 'meta_description_en', 'focus_keyword', 'canonical_url', 'noindex', 'nofollow']),
            'price_minor' => $course->purchasableVariants()->with('prices')->get()->map(fn ($variant) => $variant->currentPrice()?->amount_minor)->filter(fn ($amount) => $amount !== null)->min(),
            'sections' => $course->sections->map(function ($section) {
                return array_merge($section->toArray(), ['lessons' => $section->lessons->map(
                    fn (Lesson $lesson) => $lesson->makeVisible(['video_url', 'video_asset_id'])->toArray()
                )->values()]);
            })->values(),
        ]]);
    }

    public function storeSection(Request $request, Course $course): JsonResponse
    {
        $this->authorize('update', $course);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'summary' => ['nullable', 'string', 'max:512'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'drip_days' => ['nullable', 'integer', 'min:0', 'max:3650'],
        ]);

        $validated['position'] ??= ($course->sections()->max('position') ?? -1) + 1;

        return response()->json(['data' => $course->sections()->create($validated)], 201);
    }

    public function updateSection(Request $request, Course $course, CourseSection $section): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($section->course_id === $course->getKey(), 404);

        $section->update($request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'summary' => ['sometimes', 'nullable', 'string', 'max:512'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'drip_days' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:3650'],
        ]));

        return response()->json(['data' => $section->fresh()]);
    }

    public function destroySection(Request $request, Course $course, CourseSection $section): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($section->course_id === $course->getKey(), 404);

        $section->delete();

        return response()->json(['message' => 'Section deleted.']);
    }

    public function storeLesson(Request $request, Course $course): JsonResponse
    {
        $this->authorize('update', $course);

        $validated = $request->validate($this->lessonRules($course, null));
        $validated['position'] ??= ($course->lessons()->max('position') ?? -1) + 1;

        return response()->json([
            'data' => $course->lessons()->create($validated),
        ], 201);
    }

    public function updateLesson(Request $request, Course $course, Lesson $lesson): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->getKey(), 404);

        $lesson->update($request->validate($this->lessonRules($course, $lesson->getKey())));

        return response()->json(['data' => $lesson->fresh()]);
    }

    public function destroyLesson(Request $request, Course $course, Lesson $lesson): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->getKey(), 404);

        $lesson->delete();

        return response()->json(['message' => 'Lesson deleted.']);
    }

    /** Bulk reorder so drag-and-drop in the admin is a single request. */
    public function reorder(Request $request, Course $course): JsonResponse
    {
        $this->authorize('update', $course);

        $validated = $request->validate([
            'lessons' => ['required', 'array'],
            'lessons.*.id' => ['required', 'integer'],
            'lessons.*.course_section_id' => ['required', 'integer'],
            'lessons.*.position' => ['required', 'integer', 'min:0'],
        ]);

        $sectionIds = $course->sections()->pluck('id')->all();
        $lessonIds = $course->lessons()->pluck('id')->all();

        DB::transaction(function () use ($validated, $sectionIds, $lessonIds) {
            foreach ($validated['lessons'] as $row) {
                // Both ids must already belong to this course.
                if (! in_array($row['id'], $lessonIds, true) || ! in_array($row['course_section_id'], $sectionIds, true)) {
                    abort(422, 'A lesson or section in this request does not belong to the course.');
                }

                Lesson::query()->whereKey($row['id'])->update([
                    'course_section_id' => $row['course_section_id'],
                    'position' => $row['position'],
                ]);
            }
        });

        return response()->json(['data' => $course->fresh()->load('sections.lessons')->sections]);
    }

    private function lessonRules(Course $course, ?int $lessonId): array
    {
        return [
            'course_section_id' => [
                $lessonId ? 'sometimes' : 'required', 'integer',
                Rule::exists('course_sections', 'id')->where('course_id', $course->getKey()),
            ],
            'slug' => [
                $lessonId ? 'sometimes' : 'required', 'string', 'max:180',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('lessons', 'slug')->where('course_id', $course->getKey())->ignore($lessonId),
            ],
            'title' => [$lessonId ? 'sometimes' : 'required', 'string', 'max:255'],
            'type' => ['sometimes', 'string', 'in:'.implode(',', LessonType::values())],
            'body_markdown' => ['nullable', 'string', 'max:200000'],
            'video_provider' => ['nullable', 'string', 'in:bunny,vimeo'],
            'video_asset_id' => ['nullable', 'string', 'max:128'],
            'video_url' => ['nullable', 'string', 'max:2048', function ($attribute, $value, $fail) {
                if (LessonVideoUrl::descriptor($value) === null) {
                    $fail('Enter a valid HTTPS video link (YouTube, Vimeo or another video website).');
                }
            }],
            'duration_seconds' => ['nullable', 'integer', 'min:1', 'max:86400'],
            'is_free_preview' => ['sometimes', 'boolean'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'drip_days' => ['nullable', 'integer', 'min:0', 'max:3650'],
        ];
    }
}
