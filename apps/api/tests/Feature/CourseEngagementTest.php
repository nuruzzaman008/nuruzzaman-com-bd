<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\EnrollmentStatus;
use App\Enums\Role as RoleEnum;
use App\Models\Course;
use App\Models\CourseQuestion;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Q&A moderation, private notes, the gradebook and the wishlist.
 */
class CourseEngagementTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;

    private Lesson $lesson;

    protected function setUp(): void
    {
        parent::setUp();

        $this->course = Course::factory()->published()->create();
        $section = $this->course->sections()->create(['title' => 'Module 1', 'position' => 0]);

        $this->lesson = $this->course->lessons()->create([
            'course_section_id' => $section->id,
            'slug' => 'lesson-one',
            'title' => 'Lesson one',
            'type' => 'text',
            'body_markdown' => 'Body.',
            'position' => 0,
        ]);
    }

    private function enroll(User $user): Enrollment
    {
        return Enrollment::create([
            'user_id' => $user->getKey(),
            'course_id' => $this->course->getKey(),
            'status' => EnrollmentStatus::Active,
            'starts_at' => now(),
        ]);
    }

    public function test_a_question_is_held_for_moderation_and_only_its_author_sees_it_meanwhile(): void
    {
        $asker = $this->customer();
        $classmate = $this->customer();
        $this->enroll($asker);
        $this->enroll($classmate);

        $this->actingAs($asker)
            ->postJson('/api/v1/learn/'.$this->course->slug.'/questions', [
                'title' => 'Why is the footing depth 1.5 m?',
                'body' => 'The example uses 1.5 m. Where does that come from?',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'in_review');

        // The author still sees their own pending question.
        $this->actingAs($asker)
            ->getJson('/api/v1/learn/'.$this->course->slug.'/questions')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        // A classmate does not.
        $this->actingAs($classmate)
            ->getJson('/api/v1/learn/'.$this->course->slug.'/questions')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_a_visitor_without_an_enrollment_cannot_read_or_ask(): void
    {
        $outsider = $this->customer();

        $this->actingAs($outsider)
            ->getJson('/api/v1/learn/'.$this->course->slug.'/questions')
            ->assertStatus(404);

        $this->actingAs($outsider)
            ->postJson('/api/v1/learn/'.$this->course->slug.'/questions', [
                'title' => 'Let me in',
                'body' => 'Please.',
            ])
            ->assertStatus(404);
    }

    public function test_publishing_a_question_makes_it_visible_to_the_class(): void
    {
        $asker = $this->customer();
        $classmate = $this->customer();
        $enrollment = $this->enroll($asker);
        $this->enroll($classmate);

        $question = CourseQuestion::create([
            'course_id' => $this->course->getKey(),
            'enrollment_id' => $enrollment->getKey(),
            'user_id' => $asker->getKey(),
            'title' => 'Bar spacing?',
            'body' => 'What spacing did you assume?',
            'status' => ContentStatus::InReview,
        ]);

        $staff = $this->userWithRole(RoleEnum::Admin);

        $this->actingAs($staff)
            ->postJson('/api/v1/admin/course-questions/'.$question->getKey().'/moderate', [
                'status' => 'published',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'published');

        $this->actingAs($classmate)
            ->getJson('/api/v1/learn/'.$this->course->slug.'/questions')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_notes_are_private_to_the_learner_who_wrote_them(): void
    {
        $author = $this->customer();
        $other = $this->customer();
        $this->enroll($author);
        $this->enroll($other);

        $this->actingAs($author)
            ->postJson('/api/v1/learn/'.$this->course->slug.'/lessons/lesson-one/notes', [
                'body' => 'Check the 0.85 factor against BNBC.',
                'position_seconds' => 42,
            ])
            ->assertStatus(201);

        $this->actingAs($author)
            ->getJson('/api/v1/learn/'.$this->course->slug.'/notes')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        // The other learner's note list is their own, and stays empty.
        $this->actingAs($other)
            ->getJson('/api/v1/learn/'.$this->course->slug.'/notes')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_another_learner_cannot_delete_a_note_by_guessing_its_id(): void
    {
        $author = $this->customer();
        $other = $this->customer();
        $this->enroll($author);
        $this->enroll($other);

        $noteId = $this->actingAs($author)
            ->postJson('/api/v1/learn/'.$this->course->slug.'/lessons/lesson-one/notes', [
                'body' => 'Private working.',
            ])
            ->json('data.id');

        $this->actingAs($other)
            ->deleteJson('/api/v1/learn/'.$this->course->slug.'/notes/'.$noteId)
            ->assertStatus(404);

        $this->assertDatabaseHas('lesson_notes', ['id' => $noteId]);
    }

    public function test_the_gradebook_reports_an_ungraded_assignment_as_ungraded_not_zero(): void
    {
        $user = $this->customer();
        $this->enroll($user);

        $this->course->assignments()->create([
            'title' => 'Submit your footing schedule',
            'brief_markdown' => 'Attach the PDF.',
        ]);

        $body = $this->actingAs($user)
            ->getJson('/api/v1/learn/'.$this->course->slug.'/gradebook')
            ->assertOk()
            ->json('data');

        $this->assertNull($body['average_percent']);
        $this->assertSame('not_submitted', $body['assignments'][0]['status']);
        $this->assertNull($body['assignments'][0]['score_percent']);
        $this->assertSame(1, $body['lessons']['total']);
        $this->assertSame(0, $body['lessons']['completed']);
    }

    public function test_a_course_can_be_saved_to_and_removed_from_the_wishlist(): void
    {
        $user = $this->customer();

        $this->actingAs($user)
            ->putJson('/api/v1/account/wishlist/'.$this->course->slug)
            ->assertStatus(201);

        $this->actingAs($user)
            ->getJson('/api/v1/account/wishlist')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        // Saving twice is idempotent rather than an error.
        $this->actingAs($user)
            ->putJson('/api/v1/account/wishlist/'.$this->course->slug)
            ->assertStatus(201);

        $this->actingAs($user)
            ->getJson('/api/v1/account/wishlist')
            ->assertJsonCount(1, 'data');

        $this->actingAs($user)
            ->deleteJson('/api/v1/account/wishlist/'.$this->course->slug)
            ->assertStatus(204);

        $this->actingAs($user)
            ->getJson('/api/v1/account/wishlist')
            ->assertJsonCount(0, 'data');
    }
}
