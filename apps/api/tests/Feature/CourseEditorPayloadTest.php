<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Course;
use App\Models\Media;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What the course editor loads, and what its saves leave alone.
 *
 * The editor fills its form from /curriculum and sends the form back, so a
 * field missing from that payload would load empty and be saved back empty -
 * clearing a subtitle, or an image, the course already had.
 */
class CourseEditorPayloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_editor_loads_the_subtitle_track_and_image(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $medium = Media::factory()->create(['alt_text' => 'Footing reinforcement']);
        $course = Course::factory()->create([
            'subtitle' => 'Isolated footings, step by step',
            'track' => 'foundation-geotechnical',
            'cover_media_id' => $medium->id,
        ]);

        $this->getJson('/api/v1/admin/courses/'.$course->id.'/curriculum')
            ->assertOk()
            ->assertJsonPath('data.subtitle', 'Isolated footings, step by step')
            ->assertJsonPath('data.track', 'foundation-geotechnical')
            ->assertJsonPath('data.cover_media_id', $medium->id)
            ->assertJsonPath('data.cover_alt', 'Footing reinforcement')
            ->assertJsonPath('data.cover_url', $medium->url());
    }

    public function test_a_course_without_an_image_says_so_rather_than_omitting_it(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $course = Course::factory()->create(['cover_media_id' => null]);

        $this->getJson('/api/v1/admin/courses/'.$course->id.'/curriculum')
            ->assertOk()
            ->assertJsonPath('data.cover_media_id', null)
            ->assertJsonPath('data.cover_url', null);
    }

    public function test_saving_the_words_keeps_the_existing_image(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $medium = Media::factory()->create();
        $course = Course::factory()->create(['cover_media_id' => $medium->id, 'subtitle' => 'Kept']);

        // What the editor sends when the image was not touched: no cover key.
        $this->patchJson('/api/v1/admin/courses/'.$course->id, [
            'title' => 'A new title',
            'subtitle' => 'Kept',
            'description_markdown' => 'A rewritten description.',
            'seo' => ['meta_title' => 'A title for search', 'noindex' => false, 'nofollow' => false],
        ])->assertOk();

        $fresh = $course->fresh();
        $this->assertSame('A new title', $fresh->title);
        $this->assertSame('Kept', $fresh->subtitle);
        $this->assertSame($medium->id, $fresh->cover_media_id);
    }

    public function test_an_image_can_be_set_and_cleared(): void
    {
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $medium = Media::factory()->create();
        $course = Course::factory()->create(['cover_media_id' => null]);

        $this->patchJson('/api/v1/admin/courses/'.$course->id, ['cover_media_id' => $medium->id])->assertOk();
        $this->assertSame($medium->id, $course->fresh()->cover_media_id);

        $this->patchJson('/api/v1/admin/courses/'.$course->id, ['cover_media_id' => null])->assertOk();
        $this->assertNull($course->fresh()->cover_media_id);
    }
}
