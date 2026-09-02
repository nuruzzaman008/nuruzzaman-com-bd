<?php

namespace App\Services\Lms;

use App\Models\Enrollment;
use Illuminate\Support\Collection;

/**
 * The learner's grade summary for one course.
 *
 * Every figure is derived here from rows the server wrote — graded quiz
 * attempts, reviewed assignment submissions and lesson completions. The client
 * never supplies a score, and nothing is estimated: an ungraded assignment is
 * reported as ungraded rather than counted as zero, because a pending review is
 * not a failure.
 */
class GradebookService
{
    public function for(Enrollment $enrollment): array
    {
        $course = $enrollment->course()->withCount('lessons')->first();

        $quizzes = $this->quizRows($enrollment);
        $assignments = $this->assignmentRows($enrollment);

        $graded = $quizzes->whereNotNull('score_percent')
            ->concat($assignments->whereNotNull('score_percent'));

        return [
            'lessons' => [
                'total' => (int) ($course?->lessons_count ?? 0),
                'completed' => $enrollment->progress()->where('is_completed', true)->count(),
            ],
            'quizzes' => $quizzes->values()->all(),
            'assignments' => $assignments->values()->all(),
            // Null rather than 0 while nothing has been graded, so the panel can
            // say "not graded yet" instead of showing a failing mark.
            'average_percent' => $graded->isEmpty()
                ? null
                : (int) round($graded->avg('score_percent')),
            'pass_percentage' => (int) ($course?->pass_percentage ?? 70),
            'completed_at' => $enrollment->completed_at?->toIso8601String(),
        ];
    }

    /** Best graded attempt per quiz, plus how many attempts remain. */
    private function quizRows(Enrollment $enrollment): Collection
    {
        $attempts = $enrollment->attempts()
            ->with('quiz')
            ->whereNotNull('submitted_at')
            ->get()
            ->groupBy('quiz_id');

        return $enrollment->course->quizzes()->get()->map(function ($quiz) use ($attempts) {
            $mine = $attempts->get($quiz->getKey()) ?? collect();
            $best = $mine->sortByDesc('score_percent')->first();

            return [
                'id' => $quiz->getKey(),
                'title' => $quiz->title,
                'score_percent' => $best?->score_percent,
                'passed' => (bool) $best?->passed,
                'attempts_used' => $mine->count(),
                'attempts_allowed' => (int) $quiz->max_attempts,
                'pass_percentage' => (int) $quiz->pass_percentage,
            ];
        });
    }

    /** Latest submission per assignment. */
    private function assignmentRows(Enrollment $enrollment): Collection
    {
        $submissions = $enrollment->submissions()
            ->get()
            ->groupBy('assignment_id');

        return $enrollment->course->assignments()->get()->map(function ($assignment) use ($submissions) {
            $latest = ($submissions->get($assignment->getKey()) ?? collect())
                ->sortByDesc('submitted_at')
                ->first();

            return [
                'id' => $assignment->getKey(),
                'title' => $assignment->title,
                'status' => $latest?->status ?? 'not_submitted',
                'score_percent' => $latest?->score_percent,
                'feedback' => $latest?->feedback,
                'pass_percentage' => (int) $assignment->pass_percentage,
                'submitted_at' => $latest?->submitted_at?->toIso8601String(),
                'reviewed_at' => $latest?->reviewed_at?->toIso8601String(),
            ];
        });
    }
}
