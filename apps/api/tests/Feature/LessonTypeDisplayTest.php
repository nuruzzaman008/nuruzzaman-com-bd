<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Lesson;
use App\Services\Lms\EnrollmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * What a learner sees follows the lesson type the teacher picked:
 * video + text, files + text, or downloads only.
 */
class LessonTypeDisplayTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('private');
        $this->course = Course::factory()->published()->create(['sequential' => false]);
        $this->actingAs($student = $this->customer(['account_mode' => 'student']));
        app(EnrollmentService::class)->enroll($student, $this->course);
    }

    /** A lesson with an uploaded video, a PDF and a Google Drive link. */
    private function lesson(string $type, string $slug): Lesson
    {
        $section = $this->course->sections()->firstOrCreate(['title' => 'Class 1']);
        $lesson = $this->course->lessons()->create([
            'course_section_id' => $section->id,
            'title' => ucfirst($type).' lesson',
            'slug' => $slug,
            'type' => $type,
            'position' => $this->course->lessons()->count(),
            'body_markdown' => "## Read this\n\nSome text.",
        ]);

        $position = 0;

        foreach (['clip.mp4' => 'Class video', 'notes.pdf' => 'Notes'] as $file => $title) {
            $path = 'lessons/'.$lesson->id.'/'.$file;
            Storage::disk('private')->put($path, str_repeat('x', 64));
            $lesson->assets()->create([
                'title' => $title, 'disk' => 'private', 'storage_path' => $path, 'size_bytes' => 64, 'position' => $position++,
            ]);
        }

        $lesson->assets()->create([
            'title' => 'Slides', 'disk' => 'link', 'storage_path' => 'https://drive.google.com/file/d/1AbC/view', 'position' => $position,
        ]);

        return $lesson;
    }

    private function show(Lesson $lesson): TestResponse
    {
        return $this->getJson('/api/v1/learn/'.$this->course->slug.'/lessons/'.$lesson->slug)->assertOk();
    }

    private function download(Lesson $lesson, string $title): TestResponse
    {
        $asset = $lesson->assets()->where('title', $title)->firstOrFail();

        return $this->get('/api/v1/learn/'.$this->course->slug.'/lessons/'.$lesson->slug.'/assets/'.$asset->id);
    }

    public function test_video_and_text_plays_the_video_shows_the_text_and_does_not_offer_the_video_as_a_download(): void
    {
        $lesson = $this->lesson('video', 'watch');

        $response = $this->show($lesson)
            ->assertJsonPath('data.playback.kind', 'video')
            ->assertJsonPath('data.playback.available', true);

        $this->assertStringContainsString('<h2>', (string) $response->json('data.body_html'));
        // The video is not a file on the list; the other two still are.
        $this->assertSame(['Notes', 'Slides'], array_column($response->json('data.assets'), 'title'));

        $this->download($lesson, 'Class video')->assertForbidden();
        $this->download($lesson, 'Notes')->assertOk();
    }

    public function test_files_and_text_shows_the_text_and_every_file_and_no_player(): void
    {
        $lesson = $this->lesson('text', 'read');

        $response = $this->show($lesson)->assertJsonPath('data.playback', null);

        $this->assertStringContainsString('<h2>', (string) $response->json('data.body_html'));
        $this->assertSame(['Class video', 'Notes', 'Slides'], array_column($response->json('data.assets'), 'title'));

        // Here a video file is just a file.
        $this->download($lesson, 'Class video')->assertOk();
    }

    public function test_downloads_only_shows_the_files_and_nothing_else(): void
    {
        $lesson = $this->lesson('download', 'files');

        $response = $this->show($lesson)
            ->assertJsonPath('data.playback', null)
            ->assertJsonPath('data.body_html', null);

        $this->assertSame(['Class video', 'Notes', 'Slides'], array_column($response->json('data.assets'), 'title'));
        $this->download($lesson, 'Notes')->assertOk();

        // The text is kept, only not shown: switching back brings it back.
        $this->assertNotNull($lesson->fresh()->body_markdown);
    }

    public function test_the_outline_counts_a_video_lesson_s_video_as_its_video_not_as_a_file(): void
    {
        $this->lesson('video', 'watch');
        $this->lesson('text', 'read');

        $this->getJson('/api/v1/learn/'.$this->course->slug.'/outline')
            ->assertOk()
            ->assertJsonPath('data.sections.0.lessons.0.has_video', true)
            ->assertJsonPath('data.sections.0.lessons.0.assets_count', 2)
            ->assertJsonPath('data.sections.0.lessons.1.has_video', false)
            ->assertJsonPath('data.sections.0.lessons.1.assets_count', 3);
    }
}
