<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Services\Lms\EnrollmentService;
use App\Services\Video\VideoPlaybackService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class LessonAttachmentVideoTest extends TestCase
{
    use RefreshDatabase;

    public function test_existing_attachment_plays_with_range_support_and_access_is_rechecked(): void
    {
        Storage::fake('private');
        $course = Course::factory()->published()->create(['sequential' => false]);
        $lesson = $course->lessons()->create(['course_section_id' => $course->sections()->create(['title' => 'Videos'])->id, 'title' => 'Video attachment', 'slug' => 'video-attachment', 'type' => 'video']);
        $path = 'lessons/'.$lesson->id.'/clip.mp4';
        Storage::disk('private')->put($path, str_repeat('v', 1024));
        $asset = $lesson->assets()->create(['title' => 'Clip', 'disk' => 'private', 'storage_path' => $path, 'mime_type' => 'video/mp4']);
        $student = $this->customer();
        $enrollment = app(EnrollmentService::class)->enroll($student, $course);
        $this->actingAs($student);
        $url = $this->getJson('/api/v1/learn/'.$course->slug.'/lessons/'.$lesson->slug)->assertOk()->assertJsonPath('data.playback.kind', 'video')->assertJsonPath('data.playback.available', true)->json('data.playback.url');
        $this->assertStringContainsString('asset='.$asset->id, $url);
        $this->get($url, ['Range' => 'bytes=0-9'])->assertStatus(206)->assertHeader('Content-Type', 'video/mp4')->assertHeader('Content-Range', 'bytes 0-9/1024');
        $this->get($url.'&asset=999999')->assertForbidden();
        $enrollment->update(['status' => 'revoked']);
        $this->get($url)->assertForbidden();
    }

    public function test_webm_fallback_does_not_override_an_explicit_video_or_play_documents(): void
    {
        $course = Course::factory()->published()->create();
        $lesson = $course->lessons()->create(['course_section_id' => $course->sections()->create(['title' => 'Videos'])->id, 'title' => 'Attachments', 'slug' => 'attachments', 'type' => 'download']);
        $lesson->assets()->create(['title' => 'Notes', 'disk' => 'private', 'storage_path' => 'lessons/'.$lesson->id.'/notes.pdf']);
        $service = app(VideoPlaybackService::class);
        $this->assertFalse($service->playbackFor($lesson->fresh())['available']);
        $lesson->assets()->create(['title' => 'Clip', 'disk' => 'private', 'storage_path' => 'lessons/'.$lesson->id.'/clip.webm']);
        $this->assertTrue($service->playbackFor($lesson->fresh())['available']);
        $lesson->update(['video_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']);
        $this->assertSame('youtube', $service->playbackFor($lesson->fresh())['provider']);
    }

    public function test_signed_attachment_cannot_read_another_lesson_or_non_video_file(): void
    {
        $course = Course::factory()->published()->create(['sequential' => false]);
        $lesson = $course->lessons()->create(['course_section_id' => $course->sections()->create(['title' => 'Videos'])->id, 'title' => 'Preview', 'slug' => 'preview', 'type' => 'video', 'is_free_preview' => true]);
        $other = $course->lessons()->create(['course_section_id' => $course->sections()->create(['title' => 'Videos'])->id, 'title' => 'Other', 'slug' => 'other', 'type' => 'video']);
        $foreign = $other->assets()->create(['title' => 'Clip', 'disk' => 'private', 'storage_path' => 'lessons/'.$other->id.'/clip.mp4']);
        $pdf = $lesson->assets()->create(['title' => 'Notes', 'disk' => 'private', 'storage_path' => 'lessons/'.$lesson->id.'/notes.pdf']);
        foreach ([$foreign, $pdf] as $asset) {
            $url = URL::temporarySignedRoute('lesson.video.stream', now()->addHour(), ['lesson' => $lesson->id, 'asset' => $asset->id, 'viewer' => 0], absolute: false);
            $this->get($url)->assertNotFound();
        }
    }
}
