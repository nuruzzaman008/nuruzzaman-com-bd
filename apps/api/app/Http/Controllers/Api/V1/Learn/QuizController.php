<?php

namespace App\Http\Controllers\Api\V1\Learn;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Services\Lms\QuizService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuizController extends Controller
{
    public function __construct(private readonly QuizService $quizzes) {}

    /** Questions and options without any correctness hint. */
    public function show(Request $request, int $quizId): JsonResponse
    {
        $quiz = Quiz::query()->with('questions.options')->findOrFail($quizId);
        $enrollment = $this->enrollment($request, $quiz);

        return response()->json([
            'data' => [
                'id' => $quiz->id,
                'title' => $quiz->title,
                'instructions' => $quiz->instructions,
                'pass_percentage' => $quiz->pass_percentage,
                'max_attempts' => $quiz->max_attempts,
                'attempts_used' => $quiz->attempts()->where('enrollment_id', $enrollment->getKey())->count(),
                'time_limit_seconds' => $quiz->time_limit_seconds,
                'questions' => $quiz->questions
                    ->when($quiz->shuffle_questions, fn ($questions) => $questions->shuffle())
                    ->map(fn ($question) => [
                        'id' => $question->id,
                        'type' => $question->type,
                        'prompt' => $question->prompt,
                        'points' => $question->points,
                        'options' => $question->options->map(fn ($option) => [
                            'id' => $option->id,
                            'label' => $option->label,
                        ])->values(),
                    ])->values(),
            ],
        ]);
    }

    public function start(Request $request, int $quizId): JsonResponse
    {
        $quiz = Quiz::query()->with('questions')->findOrFail($quizId);
        $attempt = $this->quizzes->start($quiz, $this->enrollment($request, $quiz));

        return response()->json([
            'data' => [
                'attempt_id' => $attempt->id,
                'attempt_number' => $attempt->attempt_number,
                'started_at' => $attempt->started_at->toIso8601String(),
                'points_possible' => $attempt->points_possible,
            ],
        ], 201);
    }

    public function submit(Request $request, int $attemptId): JsonResponse
    {
        $validated = $request->validate([
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.question_id' => ['required', 'integer'],
            'answers.*.option_ids' => ['sometimes', 'array'],
            'answers.*.option_ids.*' => ['integer'],
            'answers.*.text' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        $attempt = QuizAttempt::query()->with('enrollment')->findOrFail($attemptId);

        abort_unless($attempt->user_id === $request->user()->getKey(), 403, 'This attempt is not yours.');

        $graded = $this->quizzes->submit($attempt, $validated['answers']);

        return response()->json([
            'data' => [
                'attempt_id' => $graded->id,
                'score_percent' => $graded->score_percent,
                'points_awarded' => $graded->points_awarded,
                'points_possible' => $graded->points_possible,
                'passed' => (bool) $graded->passed,
                'answers' => $graded->answers->map(fn ($answer) => [
                    'question_id' => $answer->quiz_question_id,
                    'is_correct' => (bool) $answer->is_correct,
                    'points_awarded' => $answer->points_awarded,
                ])->values(),
            ],
        ]);
    }

    private function enrollment(Request $request, Quiz $quiz): Enrollment
    {
        /** @var Enrollment $enrollment */
        $enrollment = Enrollment::query()
            ->where('user_id', $request->user()->getKey())
            ->where('course_id', $quiz->course_id)
            ->firstOrFail();

        $this->authorize('learn', $enrollment);

        return $enrollment;
    }
}
