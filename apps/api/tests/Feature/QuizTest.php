<?php

namespace Tests\Feature;

use App\Enums\EnrollmentStatus;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuizTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;

    private Quiz $quiz;

    private array $correct = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->course = Course::factory()->published()->create();
        $section = $this->course->sections()->create(['title' => 'Module', 'position' => 0]);
        $lesson = $this->course->lessons()->create([
            'course_section_id' => $section->id,
            'slug' => 'quiz-lesson',
            'title' => 'Quiz lesson',
            'type' => 'quiz',
            'position' => 0,
        ]);

        $this->quiz = Quiz::create([
            'course_id' => $this->course->id,
            'lesson_id' => $lesson->id,
            'title' => 'Module check',
            'pass_percentage' => 60,
            'max_attempts' => 2,
        ]);

        foreach ([['2', ['1', '2', '3']], ['B', ['A', 'B', 'C']]] as $index => [$answer, $options]) {
            $question = $this->quiz->questions()->create([
                'type' => 'single_choice',
                'prompt' => 'Question '.($index + 1),
                'points' => 1,
                'position' => $index,
            ]);

            foreach ($options as $position => $label) {
                $option = $question->options()->create([
                    'label' => $label,
                    'is_correct' => $label === $answer,
                    'position' => $position,
                ]);

                if ($label === $answer) {
                    $this->correct[$question->id] = $option->id;
                }
            }
        }
    }

    private function enrolled(): User
    {
        $user = $this->customer();

        Enrollment::create([
            'user_id' => $user->getKey(),
            'course_id' => $this->course->getKey(),
            'status' => EnrollmentStatus::Active,
            'starts_at' => now(),
        ]);

        return $user;
    }

    public function test_the_quiz_payload_never_reveals_which_option_is_correct(): void
    {
        $response = $this->actingAs($this->enrolled())
            ->getJson('/api/v1/quizzes/'.$this->quiz->id)
            ->assertOk();

        $this->assertStringNotContainsString('is_correct', $response->getContent());
    }

    public function test_a_correct_submission_passes_and_completes_the_lesson(): void
    {
        $user = $this->enrolled();

        $attemptId = $this->actingAs($user)
            ->postJson('/api/v1/quizzes/'.$this->quiz->id.'/attempts')
            ->assertCreated()
            ->json('data.attempt_id');

        $this->actingAs($user)
            ->postJson('/api/v1/quiz-attempts/'.$attemptId.'/submit', [
                'answers' => collect($this->correct)
                    ->map(fn ($optionId, $questionId) => [
                        'question_id' => $questionId,
                        'option_ids' => [$optionId],
                    ])->values()->all(),
            ])
            ->assertOk()
            ->assertJsonPath('data.score_percent', 100)
            ->assertJsonPath('data.passed', true);

        $this->assertDatabaseHas('lesson_progress', ['is_completed' => true]);
    }

    public function test_a_wrong_submission_fails_and_does_not_complete_the_lesson(): void
    {
        $user = $this->enrolled();

        $attemptId = $this->actingAs($user)
            ->postJson('/api/v1/quizzes/'.$this->quiz->id.'/attempts')
            ->json('data.attempt_id');

        $this->actingAs($user)
            ->postJson('/api/v1/quiz-attempts/'.$attemptId.'/submit', [
                'answers' => collect($this->correct)
                    ->map(fn ($optionId, $questionId) => [
                        'question_id' => $questionId,
                        'option_ids' => [$optionId + 100],
                    ])->values()->all(),
            ])
            ->assertOk()
            ->assertJsonPath('data.score_percent', 0)
            ->assertJsonPath('data.passed', false);

        $this->assertDatabaseMissing('lesson_progress', ['is_completed' => true]);
    }

    public function test_the_attempt_limit_is_enforced(): void
    {
        $user = $this->enrolled();

        $this->actingAs($user)->postJson('/api/v1/quizzes/'.$this->quiz->id.'/attempts')->assertCreated();
        $this->actingAs($user)->postJson('/api/v1/quizzes/'.$this->quiz->id.'/attempts')->assertCreated();

        $this->actingAs($user)
            ->postJson('/api/v1/quizzes/'.$this->quiz->id.'/attempts')
            ->assertStatus(403);
    }

    public function test_a_learner_cannot_submit_someone_elses_attempt(): void
    {
        $owner = $this->enrolled();
        $attemptId = $this->actingAs($owner)
            ->postJson('/api/v1/quizzes/'.$this->quiz->id.'/attempts')
            ->json('data.attempt_id');

        $intruder = $this->enrolled();

        $this->actingAs($intruder)
            ->postJson('/api/v1/quiz-attempts/'.$attemptId.'/submit', [
                'answers' => [['question_id' => array_key_first($this->correct), 'option_ids' => []]],
            ])
            ->assertStatus(403);
    }
}
