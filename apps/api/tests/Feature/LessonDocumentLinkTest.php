<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Course;
use App\Models\Lesson;
use App\Services\Lms\EnrollmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Lesson documents linked from Google Drive, Dropbox and the like, rather than uploaded. */
class LessonDocumentLinkTest extends TestCase
{
    use RefreshDatabase;

    private function lesson(Course $course): Lesson
    {
        $section = $course->sections()->create(['title' => 'Class one']);

        return $course->lessons()->create([
            'course_section_id' => $section->id,
            'title' => 'Documents',
            'slug' => 'documents',
            'type' => 'download',
        ]);
    }

    private function linksUrl(Course $course, Lesson $lesson): string
    {
        return '/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id.'/links';
    }

    public function test_a_google_drive_link_opens_only_for_enrolled_students(): void
    {
        $course = Course::factory()->published()->create(['sequential' => false]);
        $lesson = $this->lesson($course);
        $drive = 'https://drive.google.com/file/d/1AbC_dEf/view?usp=sharing';

        $assetId = $this->actingAs($this->userWithRole(Role::SuperAdmin))
            ->postJson($this->linksUrl($course, $lesson), ['url' => $drive, 'title' => 'Septic tank design'])
            ->assertCreated()
            ->assertJsonPath('data.kind', 'link')
            ->assertJsonPath('data.link_url', $drive)
            ->assertJsonPath('data.title', 'Septic tank design')
            ->json('data.id');

        $this->getJson('/api/v1/admin/courses/'.$course->id.'/curriculum')
            ->assertOk()
            ->assertJsonPath('data.sections.0.lessons.0.assets.0.link_url', $drive)
            ->assertJsonMissingPath('data.sections.0.lessons.0.assets.0.storage_path');

        $student = $this->customer(['account_mode' => 'student']);
        $download = '/api/v1/learn/'.$course->slug.'/lessons/documents/assets/'.$assetId;

        $this->actingAs($student)->get($download)->assertForbidden();

        app(EnrollmentService::class)->enroll($student, $course);

        $this->get($download)->assertRedirect($drive);

        $this->getJson('/api/v1/learn/'.$course->slug.'/lessons/documents')
            ->assertOk()
            ->assertJsonPath('data.assets.0.kind', 'link')
            ->assertJsonPath('data.assets.0.provider', 'google_drive')
            ->assertJsonMissingPath('data.assets.0.link_url');
    }

    public function test_a_dropbox_share_link_downloads_the_file_itself(): void
    {
        $course = Course::factory()->create();
        $lesson = $this->lesson($course);

        $this->actingAs($this->userWithRole(Role::SuperAdmin))
            ->postJson($this->linksUrl($course, $lesson), [
                'url' => 'https://www.dropbox.com/scl/fi/abc123/Notes.pdf?rlkey=xyz&dl=0',
            ])
            ->assertCreated()
            ->assertJsonPath('data.link_url', 'https://www.dropbox.com/scl/fi/abc123/Notes.pdf?rlkey=xyz&dl=1')
            ->assertJsonPath('data.title', 'Dropbox document');
    }

    public function test_only_a_full_https_link_is_accepted_and_only_from_staff(): void
    {
        $course = Course::factory()->create();
        $lesson = $this->lesson($course);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        foreach ([
            'http://drive.google.com/file/d/1/view',
            'javascript:alert(1)',
            'drive.google.com/file/d/1/view',
            'https://user:secret@example.com/notes.pdf',
            'https://example.com/my notes.pdf',
        ] as $bad) {
            $this->postJson($this->linksUrl($course, $lesson), ['url' => $bad])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('url', 'error.fields');
        }

        $this->assertSame(0, $lesson->assets()->count());

        $this->actingAs($this->customer())
            ->postJson($this->linksUrl($course, $lesson), ['url' => 'https://example.com/notes.pdf'])
            ->assertForbidden();
    }

    public function test_deleting_a_link_touches_no_storage(): void
    {
        Storage::fake('private');
        $course = Course::factory()->create();
        $lesson = $this->lesson($course);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $assetId = $this->postJson($this->linksUrl($course, $lesson), ['url' => 'https://1drv.ms/b/s!Abc'])
            ->assertCreated()
            ->assertJsonPath('data.title', 'OneDrive document')
            ->json('data.id');

        $this->deleteJson('/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id.'/assets/'.$assetId)->assertOk();
        $this->assertDatabaseMissing('lesson_assets', ['id' => $assetId]);
    }
}
