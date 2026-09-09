<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Course;
use App\Models\Lesson;
use App\Services\Lms\EnrollmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CourseMediaPricingTest extends TestCase
{
    use RefreshDatabase;

    private function lesson(Course $course): Lesson
    {
        $section = $course->sections()->create(['title' => 'Videos']);

        return $course->lessons()->create(['course_section_id' => $section->id, 'title' => 'First', 'slug' => 'first-video', 'type' => 'video']);
    }

    public function test_price_is_used_by_catalogue_and_preserved_by_backfill(): void
    {
        $course = Course::factory()->published()->create();
        $this->lesson($course);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->putJson('/api/v1/admin/courses/'.$course->id.'/price', ['amount_minor' => 250000])->assertOk();
        $this->getJson('/api/v1/courses')->assertOk()->assertJsonPath('data.0.from_price.amount_minor', 250000);
        $this->artisan('courses:price-unpriced', ['--bdt' => 1500])->assertSuccessful();
        $this->assertSame(250000, $course->purchasableVariants()->with('prices')->first()->currentPrice()->amount_minor);
        $this->putJson('/api/v1/admin/courses/'.$course->id.'/price', ['amount_minor' => -1])->assertUnprocessable();
        $this->actingAs($this->customer())->putJson('/api/v1/admin/courses/'.$course->id.'/price', ['amount_minor' => 1])->assertForbidden();
    }

    public function test_new_course_gets_a_price(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin))->postJson('/api/v1/admin/courses', ['title' => 'Video Course', 'slug' => 'video-course', 'price_minor' => 180000])->assertCreated();
        $course = Course::where('slug', 'video-course')->firstOrFail();
        $this->assertSame(180000, $course->purchasableVariants()->with('prices')->first()->currentPrice()->amount_minor);
    }

    public function test_uploaded_video_supports_range_and_rechecks_enrollment(): void
    {
        Storage::fake('private');
        $course = Course::factory()->published()->create();
        $lesson = $this->lesson($course);
        $this->actingAs($this->userWithRole(Role::SuperAdmin))->postJson('/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id.'/video', ['video' => UploadedFile::fake()->create('lesson.mp4', 20, 'video/mp4')])->assertCreated();
        $lesson->refresh();
        Storage::disk('private')->put($lesson->video_asset_id, str_repeat('x', 1024));
        $student = $this->customer();
        $enrollment = app(EnrollmentService::class)->enroll($student, $course);
        $url = $this->actingAs($student)->getJson('/api/v1/learn/'.$course->slug.'/lessons/'.$lesson->slug)->assertOk()->assertJsonPath('data.playback.kind', 'video')->json('data.playback.url');
        $this->get($url, ['Range' => 'bytes=0-9'])->assertStatus(206)->assertHeader('Content-Range', 'bytes 0-9/1024');
        $this->get($url.'&viewer=9999')->assertForbidden();
        $enrollment->update(['status' => 'revoked']);
        $this->get($url)->assertForbidden();
    }

    public function test_upload_rejects_nonvideo_and_foreign_course(): void
    {
        Storage::fake('private');
        $course = Course::factory()->create();
        $lesson = $this->lesson($course);
        $other = Course::factory()->create();
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->postJson('/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id.'/video', ['video' => UploadedFile::fake()->create('bad.exe', 20)])->assertUnprocessable();
        $this->postJson('/api/v1/admin/courses/'.$other->id.'/lessons/'.$lesson->id.'/video', ['video' => UploadedFile::fake()->create('video.mp4', 20, 'video/mp4')])->assertNotFound();
        $this->assertCount(0, Storage::disk('private')->allFiles());
    }

    public function test_uploaded_free_preview_is_public_but_its_link_expires(): void
    {
        Storage::fake('private');
        $course = Course::factory()->published()->create();
        $lesson = $this->lesson($course);
        $path = 'lesson-videos/'.$lesson->id.'/preview.mp4';
        Storage::disk('private')->put($path, str_repeat('x', 128));
        $lesson->update(['video_provider' => 'uploaded', 'video_asset_id' => $path, 'is_free_preview' => true]);
        $url = $this->getJson('/api/v1/courses/'.$course->slug.'/preview/'.$lesson->slug)
            ->assertOk()->assertJsonPath('data.playback.available', true)->json('data.playback.url');
        $this->get($url)->assertOk();
        $this->travel(3)->hours();
        $this->get($url)->assertForbidden();
    }

    public function test_file_reorder_requires_exact_lesson_assets(): void
    {
        $course = Course::factory()->create();
        $lesson = $this->lesson($course);
        $ids = [];
        foreach ([0, 1, 2] as $i) {
            $ids[] = $lesson->assets()->create(['title' => 'File '.$i, 'disk' => 'private', 'storage_path' => 'test/'.$i, 'position' => $i])->id;
        }
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $url = '/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id.'/assets/reorder';
        $this->putJson($url, ['ids' => array_reverse($ids)])->assertOk();
        $this->assertSame(array_reverse($ids), $lesson->assets()->pluck('id')->all());
        $this->putJson($url, ['ids' => [$ids[0], $ids[0], $ids[2]]])->assertUnprocessable();
        $this->putJson($url, ['ids' => [$ids[0], $ids[1], 99999]])->assertUnprocessable();
    }
}
