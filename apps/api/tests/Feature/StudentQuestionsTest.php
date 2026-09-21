<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Mail\QuestionAnsweredMail;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\User;
use App\Services\Lms\EnrollmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * A student asks under a lesson; the teaching team sees it in the dashboard
 * and answers there; the student is told. Private to the two of them unless
 * the teacher shows it to the class.
 */
class StudentQuestionsTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;

    private Lesson $lesson;

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();
        $this->course = Course::factory()->published()->create(['sequential' => false]);
        $section = $this->course->sections()->create(['title' => 'Class 1']);
        $this->lesson = $this->course->lessons()->create([
            'course_section_id' => $section->id, 'title' => '1.1 Alphabet', 'slug' => '1-1', 'type' => 'video',
        ]);
    }

    private function student(): User
    {
        $student = $this->customer(['account_mode' => 'student']);
        app(EnrollmentService::class)->enroll($student, $this->course);

        return $student;
    }

    private function ask(User $student, string $body = 'hello sir, i did not understand few alphabet sound'): int
    {
        return $this->actingAs($student)
            ->postJson('/api/v1/learn/'.$this->course->slug.'/questions', ['body' => $body, 'lesson' => '1-1'])
            ->assertCreated()
            ->json('data.id');
    }

    private function questionsSeenBy(User $user): TestResponse
    {
        return $this->actingAs($user)->getJson('/api/v1/learn/'.$this->course->slug.'/questions?lesson=1-1')->assertOk();
    }

    private function reply(User $staff, int $question, string $body = 'Listen to 0:45 again: /θ/ is the tongue between the teeth.'): TestResponse
    {
        return $this->actingAs($staff)->postJson('/api/v1/admin/course-questions/'.$question.'/replies', ['body' => $body]);
    }

    public function test_a_question_asked_under_a_lesson_needs_no_title_and_stays_private(): void
    {
        $asker = $this->student();
        $classmate = $this->student();

        $id = $this->ask($asker);

        $this->questionsSeenBy($asker)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.title', 'hello sir, i did not understand few alphabet sound')
            ->assertJsonPath('data.0.status', 'in_review')
            ->assertJsonPath('data.0.lesson.slug', '1-1');

        $this->questionsSeenBy($classmate)->assertJsonCount(0, 'data');
    }

    public function test_the_dashboard_lists_it_with_course_and_lesson_and_counts_it_as_unanswered(): void
    {
        $asker = $this->student();
        $this->ask($asker);
        $admin = $this->userWithRole(RoleEnum::Admin);

        $this->actingAs($admin)->getJson('/api/v1/admin/course-questions/unanswered-count')
            ->assertOk()
            ->assertJsonPath('data.count', 1);

        $this->actingAs($admin)->getJson('/api/v1/admin/course-questions?status=all&answered=no')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.author_name', $asker->name)
            ->assertJsonPath('data.0.course.slug', $this->course->slug)
            ->assertJsonPath('data.0.lesson.title', '1.1 Alphabet');
    }

    public function test_an_admin_answers_without_being_enrolled_and_the_student_is_told(): void
    {
        $asker = $this->student();
        $classmate = $this->student();
        $id = $this->ask($asker);
        $admin = $this->userWithRole(RoleEnum::Admin);

        $this->reply($admin, $id)
            ->assertOk()
            ->assertJsonPath('data.replies.0.from_instructor', true)
            ->assertJsonPath('data.replies.0.author_name', $admin->name);

        // The student reads it under the lesson; the question is answered.
        $this->questionsSeenBy($asker)
            ->assertJsonPath('data.0.replies.0.body', 'Listen to 0:45 again: /θ/ is the tongue between the teeth.');
        $this->assertNotNull($this->questionsSeenBy($asker)->json('data.0.answered_at'));
        $this->actingAs($admin)->getJson('/api/v1/admin/course-questions/unanswered-count')->assertJsonPath('data.count', 0);

        Mail::assertQueued(QuestionAnsweredMail::class, function (QuestionAnsweredMail $mail) use ($asker, $admin) {
            $url = $mail->content()->with['url'];

            return $mail->hasTo($asker->email)
                && $mail->answeredBy === $admin->name
                && str_ends_with($url, '/learn/'.$this->course->slug.'/1-1');
        });

        // Still private: the classmate sees nothing.
        $this->questionsSeenBy($classmate)->assertJsonCount(0, 'data');
    }

    public function test_shown_to_the_class_it_is_seen_with_its_answer(): void
    {
        $asker = $this->student();
        $classmate = $this->student();
        $id = $this->ask($asker);
        $admin = $this->userWithRole(RoleEnum::Admin);

        $this->reply($admin, $id)->assertOk();
        $this->actingAs($admin)->postJson('/api/v1/admin/course-questions/'.$id.'/moderate', ['status' => 'published'])->assertOk();

        $this->questionsSeenBy($classmate)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.replies.0.from_instructor', true);

        // And private again.
        $this->actingAs($admin)->postJson('/api/v1/admin/course-questions/'.$id.'/moderate', ['status' => 'in_review'])->assertOk();
        $this->questionsSeenBy($classmate)->assertJsonCount(0, 'data');
    }

    public function test_instructors_answer_too_while_support_and_editors_may_only_read(): void
    {
        $id = $this->ask($this->student());

        $this->reply($this->userWithRole(RoleEnum::Instructor), $id)->assertOk();
        $this->reply($this->userWithRole(RoleEnum::SuperAdmin), $id)->assertOk();

        foreach ([RoleEnum::Support, RoleEnum::Editor] as $role) {
            $staff = $this->userWithRole($role);
            $this->actingAs($staff)->getJson('/api/v1/admin/course-questions?status=all')->assertOk();
            $this->reply($staff, $id)->assertStatus(403);
        }
    }

    public function test_students_cannot_answer_from_the_dashboard_side(): void
    {
        $asker = $this->student();
        $id = $this->ask($asker);

        $this->reply($this->student(), $id)->assertStatus(403);
        $this->reply($asker, $id)->assertStatus(403);
        $this->actingAs($asker)->getJson('/api/v1/admin/course-questions/unanswered-count')->assertStatus(403);
    }

    public function test_the_answered_list_holds_answered_questions_only(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $answered = $this->ask($this->student(), 'First question');
        $this->ask($this->student(), 'Second question');
        $this->reply($admin, $answered)->assertOk();

        $this->actingAs($admin)->getJson('/api/v1/admin/course-questions?status=all&answered=yes')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $answered);

        $this->actingAs($admin)->getJson('/api/v1/admin/course-questions?status=all&answered=no')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Second question');
    }

    public function test_a_reply_needs_something_in_it(): void
    {
        $id = $this->ask($this->student());

        $this->reply($this->userWithRole(RoleEnum::Admin), $id, '')->assertStatus(422);
        Mail::assertNothingQueued();
    }
}
