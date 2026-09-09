<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Course;
use App\Models\Enrollment;
use App\Support\LessonVideoUrl;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AccountLearningWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_persists_student_mode_without_staff_privileges(): void
    {
        Notification::fake();
        $this->seedRoles();
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Student Example', 'email' => 'student@example.com', 'phone' => '01712345678',
            'password' => 'correct-horse-42', 'password_confirmation' => 'correct-horse-42',
            'accepts_terms' => true, 'account_mode' => 'student', 'roles' => ['super_admin'],
        ])->assertCreated()->assertJsonPath('data.account_mode', 'student')
            ->assertJsonPath('data.roles', ['customer']);
        $this->assertDatabaseHas('users', ['email' => 'student@example.com', 'account_mode' => 'student']);
    }

    public function test_switching_modes_preserves_enrollments_and_rejects_invalid_modes(): void
    {
        $user = $this->customer();
        $course = Course::factory()->published()->create();
        $enrollment = Enrollment::create(['user_id' => $user->id, 'course_id' => $course->id, 'status' => 'active', 'starts_at' => now()]);
        foreach (['student', 'ecommerce', 'student'] as $mode) {
            $this->actingAs($user)->patchJson('/api/v1/me', ['account_mode' => $mode])
                ->assertOk()->assertJsonPath('data.account_mode', $mode);
        }
        $this->assertDatabaseHas('enrollments', ['id' => $enrollment->id, 'user_id' => $user->id]);
        $this->patchJson('/api/v1/me', ['account_mode' => 'admin'])->assertUnprocessable();
        $this->assertSame('student', $user->fresh()->account_mode);
    }

    public function test_video_links_are_normalized_and_unsafe_schemes_rejected(): void
    {
        $this->assertSame('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', LessonVideoUrl::descriptor('https://youtu.be/dQw4w9WgXcQ?t=12')['url']);
        $this->assertSame('youtube', LessonVideoUrl::descriptor('https://www.youtube.com/watch?v=dQw4w9WgXcQ')['provider']);
        $this->assertSame('https://player.vimeo.com/video/12345?h=secret', LessonVideoUrl::descriptor('https://vimeo.com/12345/secret')['url']);
        $this->assertSame('video', LessonVideoUrl::descriptor('https://cdn.example.com/lesson.mp4?token=123')['kind']);
        $this->assertSame('link', LessonVideoUrl::descriptor('https://videos.example.com/watch/123')['kind']);
        $this->assertNull(LessonVideoUrl::descriptor('javascript:alert(1)'));
        $this->assertNull(LessonVideoUrl::descriptor('https://youtube.com/watch?v=bad'));
    }

    public function test_staff_can_create_video_lessons_upload_files_and_only_enrolled_students_can_download(): void
    {
        Storage::fake('private');
        config(['nb.downloads.disk' => 'private']);
        $admin = $this->userWithRole(Role::SuperAdmin);
        $course = Course::factory()->published()->create(['sequential' => true]);
        $base = '/api/v1/admin/courses/'.$course->id;
        $sectionId = $this->actingAs($admin)->postJson($base.'/sections', ['title' => 'Chapter one'])->assertCreated()->json('data.id');
        $lessonId = $this->postJson($base.'/lessons', [
            'course_section_id' => $sectionId, 'slug' => 'video-one', 'title' => 'Video one',
            'type' => 'video', 'video_url' => 'https://youtu.be/dQw4w9WgXcQ',
        ])->assertCreated()->json('data.id');
        $assetId = $this->post($base.'/lessons/'.$lessonId.'/assets', [
            'title' => 'Lesson notes.pdf', 'file' => UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
        $this->getJson($base.'/curriculum')->assertOk()->assertJsonPath('data.sections.0.lessons.0.video_url', 'https://youtu.be/dQw4w9WgXcQ');
        $learner = $this->customer(['account_mode' => 'student']);
        $download = '/api/v1/learn/'.$course->slug.'/lessons/video-one/assets/'.$assetId;
        $this->actingAs($learner)->getJson($download)->assertForbidden();
        Enrollment::create(['user_id' => $learner->id, 'course_id' => $course->id, 'status' => 'active', 'starts_at' => now()]);
        $lessonPath = '/api/v1/learn/'.$course->slug.'/lessons/video-one';
        $this->getJson($lessonPath)->assertOk()->assertJsonPath('data.playback.provider', 'youtube')->assertJsonMissingPath('data.video_url');
        $this->get($download)->assertOk()->assertDownload('Lesson notes.pdf');
        $this->patchJson('/api/v1/me', ['account_mode' => 'ecommerce'])->assertOk();
        $this->get($download)->assertOk();
        $this->getJson($base.'/curriculum')->assertForbidden();
        $this->postJson($base.'/lessons', ['title' => 'Intrusion'])->assertForbidden();
        $this->actingAs($admin)->postJson($base.'/lessons', [
            'course_section_id' => $sectionId, 'slug' => 'bad-link', 'title' => 'Unsafe',
            'video_url' => 'javascript:alert(1)',
        ])->assertUnprocessable();
        $this->deleteJson($base.'/lessons/'.$lessonId.'/assets/'.$assetId)->assertOk();
        $this->assertDatabaseMissing('lesson_assets', ['id' => $assetId]);
        $this->assertCount(0, Storage::disk('private')->allFiles());
    }

    public function test_upload_rejects_foreign_lesson_and_executable_file(): void
    {
        $admin = $this->userWithRole(Role::SuperAdmin);
        $course = Course::factory()->create();
        $other = Course::factory()->create();
        $section = $other->sections()->create(['title' => 'Other']);
        $lesson = $other->lessons()->create(['title' => 'Other', 'slug' => 'other', 'course_section_id' => $section->id]);
        $this->actingAs($admin)->post('/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id.'/assets', [
            'file' => UploadedFile::fake()->create('notes.pdf', 1, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertNotFound();
        $this->post('/api/v1/admin/courses/'.$other->id.'/lessons/'.$lesson->id.'/assets', [
            'file' => UploadedFile::fake()->create('shell.php', 1, 'text/plain'),
        ], ['Accept' => 'application/json'])->assertUnprocessable();
    }

    public function test_quiz_and_assignment_require_passing_results_before_lesson_completion(): void
    {
        $admin = $this->userWithRole(Role::SuperAdmin);
        $course = Course::factory()->published()->create(['sequential' => false, 'issues_certificate' => false]);
        $section = $course->sections()->create(['title' => 'Practice']);
        $lesson = $course->lessons()->create(['title' => 'Practice', 'slug' => 'practice', 'type' => 'text', 'course_section_id' => $section->id]);
        $base = '/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id;
        $quizBody = ['title' => 'Quiz', 'pass_percentage' => 70, 'max_attempts' => 3, 'questions' => [
            ['prompt' => '2 + 2?', 'options' => [['label' => '4', 'is_correct' => true], ['label' => '5', 'is_correct' => false]]],
        ]];
        $quiz = $this->actingAs($admin)->putJson($base.'/quiz', $quizBody)->assertOk()->json('data.quiz');
        $assignment = $this->putJson($base.'/assignment', ['title' => 'Practice task', 'brief_markdown' => 'Explain your calculation.', 'pass_percentage' => 60, 'max_file_size_kb' => 10240])->assertOk()->json('data.assignment');
        $user = $this->customer(['account_mode' => 'student']);
        $enrollment = Enrollment::create(['user_id' => $user->id, 'course_id' => $course->id, 'status' => 'active', 'starts_at' => now()]);
        $complete = '/api/v1/learn/'.$course->slug.'/lessons/practice/complete';
        $this->actingAs($user)->postJson($complete)->assertForbidden();
        $this->getJson('/api/v1/quizzes/'.$quiz['id'])->assertOk()->assertJsonMissingPath('data.questions.0.options.0.is_correct');
        $attempt = $this->postJson('/api/v1/quizzes/'.$quiz['id'].'/attempts')->assertCreated()->json('data.attempt_id');
        $this->postJson('/api/v1/quiz-attempts/'.$attempt.'/submit', ['answers' => [['question_id' => $quiz['questions'][0]['id'], 'option_ids' => [$quiz['questions'][0]['options'][0]['id']]]]])->assertOk()->assertJsonPath('data.passed', true);
        $this->assertSame(0, (int) $enrollment->fresh()->progress_percent);
        $this->postJson($complete)->assertForbidden();
        $this->postJson('/api/v1/assignments/'.$assignment['id'].'/submissions', [])->assertUnprocessable();
        $submission = $this->postJson('/api/v1/assignments/'.$assignment['id'].'/submissions', ['notes' => 'Adding two pairs makes four.'])->assertCreated()->json('data.id');
        $this->patchJson($base.'/submissions/'.$submission, ['score_percent' => 100])->assertForbidden();
        $this->actingAs($admin)->putJson($base.'/quiz', $quizBody)->assertConflict();
        $this->patchJson($base.'/submissions/'.$submission, ['score_percent' => 85, 'feedback' => 'Well done.'])->assertOk();
        $this->assertSame(100, (int) $enrollment->fresh()->progress_percent);
        $this->assertDatabaseHas('assignment_submissions', ['id' => $submission, 'score_percent' => 85, 'reviewed_by' => $admin->id]);
        $this->actingAs($user)->getJson('/api/v1/assignments/'.$assignment['id'])->assertOk()->assertJsonPath('data.submission.feedback', 'Well done.');
    }

    public function test_section_drip_cannot_be_bypassed_by_completion_or_download(): void
    {
        $user = $this->customer();
        $course = Course::factory()->published()->create(['sequential' => false]);
        $section = $course->sections()->create(['title' => 'Later', 'drip_days' => 10]);
        $lesson = $course->lessons()->create(['title' => 'Later', 'slug' => 'later', 'course_section_id' => $section->id]);
        Enrollment::create(['user_id' => $user->id, 'course_id' => $course->id, 'status' => 'active', 'starts_at' => now()]);
        $this->actingAs($user)->postJson('/api/v1/learn/'.$course->slug.'/lessons/later/complete')->assertForbidden();
        $this->getJson('/api/v1/learn/'.$course->slug.'/lessons/later/assets/1')->assertForbidden();
    }
}
