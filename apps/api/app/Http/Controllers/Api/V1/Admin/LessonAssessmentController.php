<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\AssignmentSubmission;
use App\Services\Lms\ProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class LessonAssessmentController extends Controller
{
    public function show(Course $course, Lesson $lesson): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id, 404);
        $lesson->load(['quiz.questions.options', 'assignment.submissions']);
        $lesson->quiz?->questions->each(fn ($question) => $question->options->each(fn ($option) => $option->makeVisible('is_correct')));
        return response()->json(['data' => ['quiz' => $lesson->quiz, 'assignment' => $lesson->assignment]]);
    }

    public function quiz(Request $request, Course $course, Lesson $lesson): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id, 404);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'pass_percentage' => ['required', 'integer', 'min:1', 'max:100'],
            'max_attempts' => ['required', 'integer', 'min:1', 'max:100'],
            'questions' => ['required', 'array', 'min:1', 'max:100'],
            'questions.*.prompt' => ['required', 'string', 'max:5000'],
            'questions.*.options' => ['required', 'array', 'min:2', 'max:8'],
            'questions.*.options.*.label' => ['required', 'string', 'max:2000'],
            'questions.*.options.*.is_correct' => ['required', 'boolean'],
        ]);
        foreach ($data['questions'] as $question) {
            abort_unless(collect($question['options'])->where('is_correct', true)->count() === 1, 422, 'Select exactly one correct answer per question.');
        }
        DB::transaction(function () use ($course, $lesson, $data) {
            $quiz = $lesson->quiz()->first();
            abort_if($quiz && $quiz->attempts()->exists(), 409, 'This quiz already has student attempts. Create a new lesson to change its questions.');
            $quiz = $lesson->quiz()->updateOrCreate(['lesson_id' => $lesson->id], [
                'course_id' => $course->id, 'title' => $data['title'],
                'pass_percentage' => $data['pass_percentage'], 'max_attempts' => $data['max_attempts'],
            ]);
            $quiz->questions()->delete();
            foreach ($data['questions'] as $position => $row) {
                $question = $quiz->questions()->create(['prompt' => $row['prompt'], 'type' => 'single_choice', 'points' => 1, 'position' => $position]);
                foreach ($row['options'] as $index => $option) {
                    $question->options()->create($option + ['position' => $index]);
                }
            }
        });
        return $this->show($course, $lesson);
    }

    public function assignment(Request $request, Course $course, Lesson $lesson): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id, 404);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'], 'brief_markdown' => ['required', 'string', 'max:100000'],
            'pass_percentage' => ['required', 'integer', 'min:1', 'max:100'],
            'max_file_size_kb' => ['required', 'integer', 'min:1', 'max:102400'],
        ]);
        $lesson->assignment()->updateOrCreate(['lesson_id' => $lesson->id], $data + ['course_id' => $course->id]);
        return $this->show($course, $lesson);
    }

    public function grade(Request $request, Course $course, Lesson $lesson, AssignmentSubmission $submission): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id && $lesson->assignment()->whereKey($submission->assignment_id)->exists(), 404);
        $data = $request->validate(['score_percent' => ['required', 'integer', 'min:0', 'max:100'], 'feedback' => ['nullable', 'string', 'max:5000']]);
        $submission->load(['assignment', 'enrollment']);
        DB::transaction(function () use ($request, $submission, $lesson, $data) {
            $submission->update($data + ['status' => 'reviewed', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
            if ($data['score_percent'] >= $submission->assignment->pass_percentage && $submission->enrollment->isUsable()) {
                app(ProgressService::class)->complete($submission->enrollment, $lesson);
            }
        });
        return response()->json(['data' => $submission->fresh()]);
    }

    public function download(Course $course, Lesson $lesson, AssignmentSubmission $submission): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id && $lesson->assignment()->whereKey($submission->assignment_id)->exists(), 404);
        abort_unless($submission->storage_path && Storage::disk($submission->disk)->exists($submission->storage_path), 404);
        return Storage::disk($submission->disk)->download($submission->storage_path, $submission->original_filename, ['Content-Type' => 'application/octet-stream', 'Cache-Control' => 'private, no-store']);
    }
}
