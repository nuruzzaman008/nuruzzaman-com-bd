<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Certificate;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonAsset;
use App\Services\Lms\EnrollmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Lesson files and videos too large for the host's 2 MB upload limit, sent in
 * parts; any document type except server scripts; and what the player's
 * course list is told about each lesson.
 */
class CoursePlayerUploadsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('private');
        config(['nb.downloads.disk' => 'private']);
    }

    private function lesson(Course $course, array $attributes = []): Lesson
    {
        $section = $course->sections()->firstOrCreate(['title' => 'Class one']);

        return $course->lessons()->create([
            'course_section_id' => $section->id,
            'title' => 'Lesson',
            'slug' => 'lesson-'.Str::lower(Str::random(6)),
            'type' => 'text',
            ...$attributes,
        ]);
    }

    /** @return array{0: string, 1: int} The upload id and how many parts were sent. */
    private function sendInParts(string $contents, int $partBytes = 1000): array
    {
        $uploadId = (string) Str::uuid();
        $parts = str_split($contents, $partBytes);

        foreach ($parts as $index => $part) {
            $this->post('/api/v1/admin/uploads/chunks', [
                'upload_id' => $uploadId,
                'index' => $index,
                'chunk' => UploadedFile::fake()->createWithContent($index.'.part', $part),
            ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.received', $index);
        }

        return [$uploadId, count($parts)];
    }

    private function assetsUrl(Course $course, Lesson $lesson): string
    {
        return '/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id.'/assets';
    }

    public function test_a_file_sent_in_parts_is_attached_whole(): void
    {
        $course = Course::factory()->create();
        $lesson = $this->lesson($course);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $contents = str_repeat("Septic tank design, 100 users.\n", 250);
        [$uploadId, $total] = $this->sendInParts($contents);
        $this->assertGreaterThan(1, $total);

        $assetId = $this->postJson($this->assetsUrl($course, $lesson), [
            'upload_id' => $uploadId,
            'total' => $total,
            'filename' => 'Septic tank design.docx',
        ])->assertCreated()->assertJsonPath('data.title', 'Septic tank design.docx')->json('data.id');

        $asset = LessonAsset::query()->findOrFail($assetId);
        $this->assertSame($contents, Storage::disk('private')->get($asset->storage_path));
        $this->assertStringEndsWith('.docx', $asset->storage_path);
        $this->assertSame(hash('sha256', $contents), $asset->checksum_sha256);
        $this->assertSame(strlen($contents), (int) $asset->size_bytes);

        // Once the file is whole, its parts are gone.
        $this->assertSame([], Storage::disk('private')->allFiles('upload-chunks'));
    }

    public function test_any_document_type_is_accepted_but_server_scripts_are_not(): void
    {
        $course = Course::factory()->create();
        $lesson = $this->lesson($course);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        foreach (['Beam design.pdf', 'Loads.xlsx', 'Report.docx', 'Plan.dwg', 'Calc.mcdx', 'Tools setup.exe', 'README'] as $name) {
            $this->post($this->assetsUrl($course, $lesson), [
                'file' => UploadedFile::fake()->create($name, 4),
            ], ['Accept' => 'application/json'])->assertCreated();
        }

        foreach (['shell.php', 'page.PHTML', 'notes.php.pdf', '.htaccess'] as $name) {
            $this->post($this->assetsUrl($course, $lesson), [
                'file' => UploadedFile::fake()->create($name, 4),
            ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file', 'error.fields');
        }

        $this->assertSame(7, $lesson->assets()->count());
    }

    public function test_a_missing_part_is_refused_and_nothing_is_saved(): void
    {
        $course = Course::factory()->create();
        $lesson = $this->lesson($course);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        [$uploadId, $total] = $this->sendInParts(str_repeat('x', 2500));

        $this->postJson($this->assetsUrl($course, $lesson), [
            'upload_id' => $uploadId,
            'total' => $total + 1,
            'filename' => 'Half a file.pdf',
        ])->assertUnprocessable()->assertJsonValidationErrors('upload_id', 'error.fields');

        $this->assertSame(0, $lesson->assets()->count());
        $this->assertSame([], Storage::disk('private')->allFiles('upload-chunks'));
    }

    public function test_parts_can_only_be_attached_by_the_person_who_sent_them(): void
    {
        $course = Course::factory()->create();
        $lesson = $this->lesson($course);
        $sender = $this->userWithRole(Role::SuperAdmin);

        $this->actingAs($sender);
        [$uploadId, $total] = $this->sendInParts('private drawing');

        $this->actingAs($this->userWithRole(Role::SuperAdmin))->postJson($this->assetsUrl($course, $lesson), [
            'upload_id' => $uploadId, 'total' => $total, 'filename' => 'Taken.pdf',
        ])->assertUnprocessable();

        $this->actingAs($sender)->postJson($this->assetsUrl($course, $lesson), [
            'upload_id' => $uploadId, 'total' => $total, 'filename' => 'Drawing.pdf',
        ])->assertCreated();
    }

    public function test_a_part_over_the_limit_or_from_outside_the_admin_area_is_refused(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin))->post('/api/v1/admin/uploads/chunks', [
            'upload_id' => (string) Str::uuid(),
            'index' => 0,
            'chunk' => UploadedFile::fake()->create('0.part', 2048),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('chunk', 'error.fields');

        $this->actingAs($this->customer())->post('/api/v1/admin/uploads/chunks', [
            'upload_id' => (string) Str::uuid(),
            'index' => 0,
            'chunk' => UploadedFile::fake()->create('0.part', 1),
        ], ['Accept' => 'application/json'])->assertForbidden();
    }

    public function test_a_video_can_arrive_in_parts(): void
    {
        $course = Course::factory()->create();
        $lesson = $this->lesson($course, ['type' => 'video']);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        // The start of a real MP4 file, so the type is recognised from the bytes.
        $mp4 = "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom".str_repeat("\x00", 3000);
        [$uploadId, $total] = $this->sendInParts($mp4);

        $this->postJson('/api/v1/admin/courses/'.$course->id.'/lessons/'.$lesson->id.'/video', [
            'upload_id' => $uploadId, 'total' => $total, 'filename' => 'Class 6.mp4',
        ])->assertCreated();

        $lesson->refresh();
        $this->assertSame('uploaded', $lesson->video_provider);
        $this->assertStringEndsWith('.mp4', (string) $lesson->video_asset_id);
        $this->assertSame($mp4, Storage::disk('private')->get($lesson->video_asset_id));
        $this->assertSame([], Storage::disk('private')->allFiles('upload-chunks'));
    }

    public function test_the_outline_describes_each_lesson_and_the_learners_certificate_and_review(): void
    {
        $course = Course::factory()->published()->create(['issues_certificate' => true, 'sequential' => false]);
        $this->lesson($course, [
            'slug' => 'watch', 'type' => 'video', 'position' => 0,
            'video_url' => 'https://www.facebook.com/watch/?v=1234567890',
        ]);
        $reading = $this->lesson($course, ['slug' => 'read', 'type' => 'text', 'position' => 1]);
        $reading->assets()->create(['title' => 'Notes.pdf', 'disk' => 'private', 'storage_path' => 'lessons/notes.pdf', 'size_bytes' => 10]);
        $reading->assets()->create(['title' => 'Loads.xlsx', 'disk' => 'private', 'storage_path' => 'lessons/loads.xlsx', 'size_bytes' => 10]);

        $student = $this->customer(['account_mode' => 'student']);
        $enrollment = app(EnrollmentService::class)->enroll($student, $course);
        $outline = '/api/v1/learn/'.$course->slug.'/outline';

        $this->actingAs($student)->getJson($outline)
            ->assertOk()
            ->assertJsonPath('data.sections.0.lessons.0.has_video', true)
            ->assertJsonPath('data.sections.0.lessons.0.assets_count', 0)
            ->assertJsonPath('data.sections.0.lessons.1.has_video', false)
            ->assertJsonPath('data.sections.0.lessons.1.assets_count', 2)
            ->assertJsonPath('data.sections.0.lessons.1.has_quiz', false)
            ->assertJsonPath('data.sections.0.lessons.1.has_assignment', false)
            ->assertJsonPath('data.certificate', null)
            ->assertJsonPath('data.review', null);

        $this->postJson('/api/v1/learn/'.$course->slug.'/reviews', ['rating' => 4, 'title' => 'Clear'])->assertSuccessful();

        Certificate::query()->create([
            'enrollment_id' => $enrollment->id,
            'user_id' => $student->id,
            'course_id' => $course->id,
            'verification_id' => 'NB-TEST-0001',
            'recipient_name' => 'Student',
            'course_title' => $course->title,
            'issued_at' => now(),
        ]);

        $this->getJson($outline)
            ->assertOk()
            ->assertJsonPath('data.review.rating', 4)
            ->assertJsonPath('data.review.title', 'Clear')
            ->assertJsonPath('data.review.status', 'in_review')
            ->assertJsonPath('data.certificate.verification_id', 'NB-TEST-0001');
    }
}
