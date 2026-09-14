<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Course;
use App\Models\CourseSection;
use App\Models\Lesson;
use App\Models\LessonAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Deleting a lesson, or a section, takes everything it holds - its files on the hosting too. */
class LessonDeletionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('private');
    }

    /** A lesson with an uploaded document, a Google Drive link and an uploaded video. */
    private function lessonWithFiles(Course $course, CourseSection $section, string $slug): Lesson
    {
        $lesson = $course->lessons()->create([
            'course_section_id' => $section->id,
            'title' => 'Lesson '.$slug,
            'slug' => $slug,
            'type' => 'video',
        ]);

        $document = 'lessons/'.$lesson->id.'/notes.pdf';
        $video = 'lesson-videos/'.$lesson->id.'/clip.mp4';
        Storage::disk('private')->put($document, 'pdf');
        Storage::disk('private')->put($video, 'mp4');

        $lesson->assets()->create([
            'title' => 'notes.pdf',
            'disk' => 'private',
            'storage_path' => $document,
            'mime_type' => 'application/pdf',
            'size_bytes' => 3,
            'checksum_sha256' => hash('sha256', 'pdf'),
            'position' => 0,
        ]);
        $lesson->assets()->create([
            'title' => 'Class notes',
            'disk' => LessonAsset::LINK_DISK,
            'storage_path' => 'https://drive.google.com/file/d/1AbC/view',
            'mime_type' => 'text/uri-list',
            'size_bytes' => 0,
            'checksum_sha256' => hash('sha256', 'https://drive.google.com/file/d/1AbC/view'),
            'position' => 1,
        ]);
        $lesson->update(['video_provider' => 'uploaded', 'video_asset_id' => $video]);

        return $lesson;
    }

    public function test_deleting_a_lesson_removes_it_its_documents_and_its_files(): void
    {
        $course = Course::factory()->create();
        $section = $course->sections()->create(['title' => 'Class one']);
        $lesson = $this->lessonWithFiles($course, $section, 'one');
        $other = $this->lessonWithFiles($course, $section, 'two');

        $this->actingAs($this->userWithRole(Role::SuperAdmin))
            ->deleteJson('/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id)
            ->assertOk();

        $this->assertModelMissing($lesson);
        $this->assertDatabaseMissing('lesson_assets', ['lesson_id' => $lesson->id]);
        Storage::disk('private')->assertMissing('lessons/'.$lesson->id.'/notes.pdf');
        Storage::disk('private')->assertMissing('lesson-videos/'.$lesson->id.'/clip.mp4');

        // The lesson beside it keeps everything.
        $this->assertModelExists($other);
        $this->assertSame(2, $other->assets()->count());
        Storage::disk('private')->assertExists('lessons/'.$other->id.'/notes.pdf');
        Storage::disk('private')->assertExists('lesson-videos/'.$other->id.'/clip.mp4');
    }

    public function test_deleting_a_section_removes_the_files_of_every_lesson_in_it(): void
    {
        $course = Course::factory()->create();
        $section = $course->sections()->create(['title' => 'Class one']);
        $kept = $course->sections()->create(['title' => 'Class two']);
        $first = $this->lessonWithFiles($course, $section, 'one');
        $second = $this->lessonWithFiles($course, $section, 'two');
        $elsewhere = $this->lessonWithFiles($course, $kept, 'three');

        $this->actingAs($this->userWithRole(Role::SuperAdmin))
            ->deleteJson('/api/v1/admin/courses/'.$course->id.'/sections/'.$section->id)
            ->assertOk();

        foreach ([$first, $second] as $lesson) {
            $this->assertModelMissing($lesson);
            Storage::disk('private')->assertMissing('lessons/'.$lesson->id.'/notes.pdf');
            Storage::disk('private')->assertMissing('lesson-videos/'.$lesson->id.'/clip.mp4');
        }

        Storage::disk('private')->assertExists('lessons/'.$elsewhere->id.'/notes.pdf');
        Storage::disk('private')->assertExists('lesson-videos/'.$elsewhere->id.'/clip.mp4');
    }

    public function test_someone_who_cannot_edit_the_course_deletes_nothing(): void
    {
        $course = Course::factory()->create();
        $section = $course->sections()->create(['title' => 'Class one']);
        $lesson = $this->lessonWithFiles($course, $section, 'one');

        $this->actingAs($this->customer())
            ->deleteJson('/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id)
            ->assertForbidden();

        $this->assertModelExists($lesson);
        Storage::disk('private')->assertExists('lessons/'.$lesson->id.'/notes.pdf');
        Storage::disk('private')->assertExists('lesson-videos/'.$lesson->id.'/clip.mp4');
    }

    public function test_a_lesson_from_another_course_is_not_found(): void
    {
        $course = Course::factory()->create();
        $other = Course::factory()->create();
        $section = $other->sections()->create(['title' => 'Class one']);
        $lesson = $this->lessonWithFiles($other, $section, 'one');

        $this->actingAs($this->userWithRole(Role::SuperAdmin))
            ->deleteJson('/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id)
            ->assertNotFound();

        $this->assertModelExists($lesson);
        Storage::disk('private')->assertExists('lessons/'.$lesson->id.'/notes.pdf');
    }
}
