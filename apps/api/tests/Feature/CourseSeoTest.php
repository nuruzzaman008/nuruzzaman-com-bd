<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Course;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourseSeoTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_course_seo_is_saved_and_available_in_editor(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $seo = ['meta_title' => 'Footing guide BN', 'meta_title_en' => 'Footing guide EN', 'meta_description' => 'Bengali description', 'meta_description_en' => 'English description', 'focus_keyword' => 'footing', 'noindex' => false, 'nofollow' => false];
        $this->postJson('/api/v1/admin/courses', ['title' => 'Footing', 'slug' => 'seo-footing', 'seo' => $seo])->assertCreated();
        $course = Course::where('slug', 'seo-footing')->firstOrFail();
        $this->getJson('/api/v1/admin/courses/'.$course->id.'/curriculum')->assertOk()->assertJsonPath('data.seo.meta_title_en', 'Footing guide EN')->assertJsonPath('data.seo.focus_keyword', 'footing');
        $this->assertSame('Footing guide BN', $course->seo->meta_title);
    }

    public function test_saved_metadata_is_localized_and_can_be_cleared_without_losing_other_fields(): void
    {
        $course = Course::factory()->published()->create();
        $section = $course->sections()->create(['title' => 'Section']);
        $course->lessons()->create(['course_section_id' => $section->id, 'title' => 'Lesson', 'slug' => 'lesson', 'type' => 'text']);
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->patchJson('/api/v1/admin/courses/'.$course->id, ['seo' => ['meta_title' => 'Custom BN', 'meta_title_en' => 'Custom EN', 'meta_description' => 'Description BN', 'meta_description_en' => 'Description EN', 'noindex' => true]])->assertOk();
        $this->getJson('/api/v1/courses/'.$course->slug.'?locale=en')->assertOk()->assertJsonPath('data.seo.meta_title', 'Custom EN')->assertJsonPath('data.seo.meta_description', 'Description EN')->assertJsonPath('data.seo.noindex', true);
        $this->getJson('/api/v1/courses/'.$course->slug.'?locale=bn')->assertOk()->assertJsonPath('data.seo.meta_title', 'Custom BN');
        $this->patchJson('/api/v1/admin/courses/'.$course->id, ['title' => 'Changed course'])->assertOk();
        $this->assertSame('Custom EN', $course->fresh()->seo->meta_title_en);
        $this->patchJson('/api/v1/admin/courses/'.$course->id, ['seo' => ['meta_title_en' => null]])->assertOk();
        $this->assertNull($course->fresh()->seo->meta_title_en);
        $this->assertSame('Custom BN', $course->fresh()->seo->meta_title);
    }

    public function test_metadata_validation_and_permissions(): void
    {
        $course = Course::factory()->create();
        $this->actingAs($this->customer())->patchJson('/api/v1/admin/courses/'.$course->id, ['seo' => ['noindex' => true]])->assertForbidden();
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->patchJson('/api/v1/admin/courses/'.$course->id, ['seo' => ['meta_title_en' => str_repeat('a', 256), 'canonical_url' => 'not-a-url']])->assertUnprocessable();
        $this->patchJson('/api/v1/admin/courses/'.$course->id, ['seo' => ['seoable_id' => 99]])->assertUnprocessable();
        $this->assertNull($course->fresh()->seo);
    }
}
