<?php

namespace App\Services\Lms;

use App\Exceptions\DomainException;
use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\QuizQuestion;
use Illuminate\Support\Facades\DB;

/**
 * Quiz grading happens entirely on the server. Option correctness is hidden
 * from the student payload, and the score is computed from stored answers.
 */
class QuizService
{
    public function __construct(private readonly ProgressService $progress) {}

    public function start(Quiz $quiz, Enrollment $enrollment): QuizAttempt
    {
        $used = $quiz->attempts()->where('enrollment_id', $enrollment->getKey())->count();

        if ($quiz->max_attempts > 0 && $used >= $quiz->max_attempts) {
            throw DomainException::forbidden('You have used all attempts for this quiz.');
        }

        return QuizAttempt::create([
            'quiz_id' => $quiz->getKey(),
            'enrollment_id' => $enrollment->getKey(),
            'user_id' => $enrollment->user_id,
            'attempt_number' => $used + 1,
            'points_possible' => (int) $quiz->questions()->sum('points'),
            'started_at' => now(),
        ]);
    }

    /**
     * @param  array<int, array{question_id:int, option_ids?:array<int,int>, text?:string}>  $answers
     */
    public function submit(QuizAttempt $attempt, array $answers): QuizAttempt
    {
        if ($attempt->submitted_at) {
            // Re-submitting a graded attempt is a no-op rather than a re-grade.
            return $attempt;
        }

        $quiz = $attempt->quiz()->with('questions.options')->firstOrFail();

        if ($quiz->time_limit_seconds && $attempt->started_at->diffInSeconds(now()) > $quiz->time_limit_seconds + 30) {
            throw DomainException::conflict('The time limit for this attempt has passed.');
        }

        return DB::transaction(function () use ($attempt, $quiz, $answers) {
            $awarded = 0;
            $possible = 0;
            $byQuestion = collect($answers)->keyBy('question_id');

            foreach ($quiz->questions as $question) {
                $possible += $question->points;
                $submitted = $byQuestion->get($question->getKey(), []);
                $selected = array_values(array_map('intval', $submitted['option_ids'] ?? []));
                sort($selected);

                $correct = $this->isCorrect($question, $selected, $submitted['text'] ?? null);
                $points = $correct ? $question->points : 0;
                $awarded += $points;

                $attempt->answers()->updateOrCreate(
                    ['quiz_question_id' => $question->getKey()],
                    [
                        'selected_option_ids' => $selected,
                        'text_answer' => $submitted['text'] ?? null,
                        'is_correct' => $correct,
                        'points_awarded' => $points,
                    ],
                );
            }

            $percent = $possible > 0 ? (int) round(($awarded / $possible) * 100) : 0;

            $attempt->update([
                'points_awarded' => $awarded,
                'points_possible' => $possible,
                'score_percent' => $percent,
                'passed' => $percent >= $quiz->pass_percentage,
                'submitted_at' => now(),
            ]);

            if ($attempt->passed && $quiz->lesson_id) {
                $this->progress->complete($attempt->enrollment, $quiz->lesson);
            }

            return $attempt->refresh()->load('answers');
        });
    }

    /** @param array<int,int> $selected */
    private function isCorrect(QuizQuestion $question, array $selected, ?string $text): bool
    {
        if ($question->type === 'short_text') {
            // Free text is not auto-graded; an instructor reviews it separately.
            return false;
        }

        $expected = $question->correctOptionIds();

        return $expected !== [] && $expected === $selected;
    }
}
