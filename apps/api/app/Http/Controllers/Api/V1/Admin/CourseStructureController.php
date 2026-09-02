<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\LessonType;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseSection;
use App\Models\Lesson;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CourseStructureController extends Controller
{
    public function storeSection(Request $request, Course $course): JsonResponse
    {
        $this->authorize('update', $course);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'summary' => ['nullable', 'string', 'max:512'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'drip_days' => ['nullable', 'integer', 'min:0', 'max:3650'],
        ]);

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
            'duration_seconds' => ['nullable', 'integer', 'min:1', 'max:86400'],
            'is_free_preview' => ['sometimes', 'boolean'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'drip_days' => ['nullable', 'integer', 'min:0', 'max:3650'],
        ];
    }
}
