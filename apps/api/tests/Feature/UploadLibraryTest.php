<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Course;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UploadLibraryTest extends TestCase
{
    use RefreshDatabase;

    private function medium(User $owner, string $disk = 'private'): Media
    {
        Storage::fake($disk);
        Storage::disk($disk)->put('example.pdf', 'private file contents');

        return Media::create(['uploaded_by' => $owner->id, 'disk' => $disk, 'path' => 'example.pdf',
            'original_name' => 'Example.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => 21]);
    }

    public function test_personal_library_and_download_are_owner_only(): void
    {
        $owner = $this->customer();
        $other = $this->customer();
        $media = $this->medium($owner);
        $url = '/api/v1/uploads/library/media/'.$media->id.'?scope=personal';
        $this->actingAs($other)->getJson('/api/v1/uploads/library?scope=personal')->assertOk()->assertJsonCount(0, 'data');
        $this->get($url)->assertNotFound();
        $this->actingAs($owner)->getJson('/api/v1/uploads/library?scope=personal')->assertOk()
            ->assertJsonPath('data.0.name', 'Example.pdf')->assertJsonMissingPath('data.0.path')->assertJsonMissingPath('data.0.disk');
        $this->get($url)->assertOk()->assertDownload('Example.pdf');
    }

    public function test_public_picker_never_lists_or_downloads_private_files_even_for_admin(): void
    {
        $admin = $this->userWithRole(Role::SuperAdmin);
        $private = $this->medium($admin);
        $public = $this->medium($admin, 'public');
        $this->actingAs($admin)->getJson('/api/v1/uploads/library?scope=public')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $public->id);
        $this->get('/api/v1/uploads/library/media/'.$private->id.'?scope=public')->assertNotFound();
        $this->actingAs($this->customer())->getJson('/api/v1/uploads/library?scope=public')->assertForbidden();
    }

    public function test_course_files_require_course_edit_permission_and_links_are_excluded(): void
    {
        Storage::fake('private');
        Storage::disk('private')->put('lessons/notes.pdf', 'lesson file');
        $course = Course::factory()->create();
        $section = $course->sections()->create(['title' => 'Section']);
        $lesson = $course->lessons()->create(['course_section_id' => $section->id, 'title' => 'Lesson', 'slug' => 'lesson', 'type' => 'download']);
        $asset = $lesson->assets()->create(['title' => 'Notes', 'disk' => 'private', 'storage_path' => 'lessons/notes.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => 11]);
        $lesson->assets()->create(['title' => 'External', 'disk' => 'link', 'storage_path' => 'https://example.com/document.pdf']);
        $query = '?scope=course&course_id='.$course->id;
        $this->actingAs($this->customer())->getJson('/api/v1/uploads/library'.$query)->assertForbidden();
        $this->get('/api/v1/uploads/library/lesson/'.$asset->id.$query)->assertForbidden();
        $this->actingAs($this->userWithRole(Role::SuperAdmin))->getJson('/api/v1/uploads/library'.$query)->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Notes.pdf');
        $this->get('/api/v1/uploads/library/lesson/'.$asset->id.$query)->assertOk()->assertDownload('Notes.pdf');
    }

    public function test_search_pagination_and_missing_files_are_handled_without_paths(): void
    {
        $owner = $this->customer();
        $media = $this->medium($owner);
        $this->actingAs($owner)->getJson('/api/v1/uploads/library?scope=personal&q=missing')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/uploads/library?scope=personal&q=Example')->assertOk()->assertJsonPath('total', 1);
        Storage::disk('private')->delete('example.pdf');
        $this->get('/api/v1/uploads/library/media/'.$media->id.'?scope=personal')->assertNotFound();
    }

    public function test_anonymous_visitors_cannot_browse_uploads(): void
    {
        $this->getJson('/api/v1/uploads/library?scope=personal')->assertUnauthorized();
    }
}
