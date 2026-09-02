<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Services\Lms\EnrollmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoursePrerequisiteTest extends TestCase
{
    use RefreshDatabase;

    private Course $basics;

    private Course $advanced;

    protected function setUp(): void
    {
        parent::setUp();

        $this->basics = Course::factory()->published()->create(['title' => 'Foundation basics']);
        $this->advanced = Course::factory()->published()->create(['title' => 'Pile cap design']);

        $this->advanced->prerequisiteCourses()->attach($this->basics->getKey(), [
            'is_blocking' => true,
            'position' => 0,
        ]);
    }

    public function test_a_free_enrollment_is_blocked_until_the_prerequisite_is_completed(): void
    {
        $user = $this->customer();
        $service = app(EnrollmentService::class);

        $this->assertSame(
            [['slug' => $this->basics->slug, 'title' => 'Foundation basics']],
            $service->unmetPrerequisites($user, $this->advanced),
        );

        $this->expectExceptionMessage('Finish these courses first: Foundation basics.');
        $service->enroll($user, $this->advanced, source: 'manual');
    }

    public function test_completing_the_prerequisite_clears_the_block(): void
    {
        $user = $this->customer();

        Enrollment::create([
            'user_id' => $user->getKey(),
            'course_id' => $this->basics->getKey(),
            'status' => 'active',
            'starts_at' => now(),
            'completed_at' => now(),
        ]);

        $service = app(EnrollmentService::class);

        $this->assertSame([], $service->unmetPrerequisites($user, $this->advanced));
        $this->assertNotNull($service->enroll($user, $this->advanced, source: 'manual')->getKey());
    }

    public function test_a_purchase_is_never_blocked_because_the_learner_has_already_paid(): void
    {
        $user = $this->customer();

        $enrollment = app(EnrollmentService::class)->enroll($user, $this->advanced);

        $this->assertNotNull($enrollment->getKey());
    }

    public function test_a_reciprocal_prerequisite_pair_is_refused(): void
    {
        $staff = $this->userWithRole(RoleEnum::Admin);

        // basics -> advanced would complete a cycle, since advanced already
        // requires basics.
        $this->actingAs($staff)
            ->putJson('/api/v1/admin/courses/'.$this->basics->getKey().'/prerequisites', [
                'prerequisites' => [['course_id' => $this->advanced->getKey(), 'is_blocking' => true]],
            ])
            ->assertStatus(422);
    }

    public function test_a_course_cannot_require_itself(): void
    {
        $staff = $this->userWithRole(RoleEnum::Admin);

        $this->actingAs($staff)
            ->putJson('/api/v1/admin/courses/'.$this->advanced->getKey().'/prerequisites', [
                'prerequisites' => [['course_id' => $this->advanced->getKey()]],
            ])
            ->assertStatus(422);
    }
}
