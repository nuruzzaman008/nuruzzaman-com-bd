<?php

namespace Tests\Feature;

use App\Enums\EnrollmentStatus;
use App\Jobs\IssueCertificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class LearningTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;

    private Lesson $first;

    private Lesson $second;

    protected function setUp(): void
    {
        parent::setUp();

        $this->course = Course::factory()->published()->create(['sequential' => true]);
        $section = $this->course->sections()->create(['title' => 'Module 1', 'position' => 0]);

        $this->first = $this->course->lessons()->create([
            'course_section_id' => $section->id,
            'slug' => 'lesson-one',
            'title' => 'Lesson one',
            'type' => 'text',
            'body_markdown' => 'First lesson body.',
            'position' => 0,
            'is_free_preview' => true,
        ]);

        $this->second = $this->course->lessons()->create([
            'course_section_id' => $section->id,
            'slug' => 'lesson-two',
            'title' => 'Lesson two',
            'type' => 'text',
            'body_markdown' => 'Second lesson body.',
            'position' => 1,
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

    public function test_a_free_preview_lesson_is_public(): void
    {
        $this->getJson('/api/v1/courses/'.$this->course->slug.'/preview/lesson-one')
            ->assertOk()
            ->assertJsonPath('data.slug', 'lesson-one');
    }

    public function test_a_paid_lesson_is_not_reachable_through_the_preview_route(): void
    {
        $this->getJson('/api/v1/courses/'.$this->course->slug.'/preview/lesson-two')
            ->assertStatus(404);
    }

    public function test_a_visitor_without_an_enrollment_cannot_open_a_lesson(): void
    {
        $user = $this->customer();

        $this->actingAs($user)
            ->getJson('/api/v1/learn/'.$this->course->slug.'/lessons/lesson-two')
            ->assertStatus(403);
    }

    public function test_sequential_courses_lock_the_next_lesson_until_the_previous_is_complete(): void
    {
        $user = $this->customer();
        $this->enroll($user);

        $this->actingAs($user)
            ->getJson('/api/v1/learn/'.$this->course->slug.'/lessons/lesson-two')
            ->assertStatus(403);

        $this->actingAs($user)
            ->postJson('/api/v1/learn/'.$this->course->slug.'/lessons/lesson-one/complete')
            ->assertOk();

        $this->actingAs($user)
            ->getJson('/api/v1/learn/'.$this->course->slug.'/lessons/lesson-two')
            ->assertOk();
    }

    public function test_progress_is_derived_on_the_server_and_completion_is_idempotent(): void
    {
        Bus::fake();
        $user = $this->customer();
        $enrollment = $this->enroll($user);

        $this->actingAs($user)
            ->postJson('/api/v1/learn/'.$this->course->slug.'/lessons/lesson-one/complete')
            ->assertOk()
            ->assertJsonPath('data.progress_percent', 50);

        // Repeating the call must not double-count.
        $this->actingAs($user)
            ->postJson('/api/v1/learn/'.$this->course->slug.'/lessons/lesson-one/complete')
            ->assertOk()
            ->assertJsonPath('data.progress_percent', 50);

        $this->actingAs($user)
            ->postJson('/api/v1/learn/'.$this->course->slug.'/lessons/lesson-two/complete')
            ->assertOk()
            ->assertJsonPath('data.progress_percent', 100);

        $this->assertNotNull($enrollment->fresh()->completed_at);
        Bus::assertDispatched(IssueCertificate::class);
    }

    public function test_the_heartbeat_cannot_report_more_than_the_lesson_duration(): void
    {
        $user = $this->customer();
        $enrollment = $this->enroll($user);
        $this->first->update(['duration_seconds' => 120]);

        $this->actingAs($user)
            ->postJson('/api/v1/learn/'.$this->course->slug.'/lessons/lesson-one/heartbeat', [
                'watched_seconds' => 86400,
            ])
            ->assertOk();

        $this->assertSame(120, $enrollment->progress()->first()->watched_seconds);
    }

    public function test_the_heartbeat_never_moves_progress_backwards(): void
    {
        $user = $this->customer();
        $enrollment = $this->enroll($user);
        $this->first->update(['duration_seconds' => 600]);

        $url = '/api/v1/learn/'.$this->course->slug.'/lessons/lesson-one/heartbeat';

        $this->actingAs($user)->postJson($url, ['watched_seconds' => 300])->assertOk();
        $this->actingAs($user)->postJson($url, ['watched_seconds' => 0])->assertOk();

        $this->assertSame(300, $enrollment->progress()->first()->watched_seconds);
    }

    public function test_a_revoked_enrollment_loses_access(): void
    {
        $user = $this->customer();
        $enrollment = $this->enroll($user);
        $enrollment->update(['status' => EnrollmentStatus::Revoked, 'revoked_at' => now()]);

        $this->actingAs($user)
            ->getJson('/api/v1/learn/'.$this->course->slug.'/lessons/lesson-one')
            ->assertStatus(403);
    }
}
