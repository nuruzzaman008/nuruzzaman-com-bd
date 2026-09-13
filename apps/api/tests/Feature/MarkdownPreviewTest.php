<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The editor preview renders with the public pages' own renderer. */
class MarkdownPreviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_editor_sees_formatting_as_readers_will(): void
    {
        $this->seedRoles();
        $editor = $this->userWithRole(RoleEnum::Editor);

        $this->actingAs($editor)
            ->postJson('/api/v1/admin/markdown/preview', [
                'markdown' => "## Loads\n\n<span data-color=\"blue\">blue</span> <script>alert(1)</script>",
            ])
            ->assertOk()
            ->assertJsonPath('data.html', fn (string $html) => str_contains($html, '<h2>Loads</h2>')
                && str_contains($html, '<span class="nb-color-blue">blue</span>')
                && ! str_contains($html, '<script'));
    }

    public function test_an_instructor_can_preview_a_lesson(): void
    {
        $this->seedRoles();

        $this->actingAs($this->userWithRole(RoleEnum::Instructor))
            ->postJson('/api/v1/admin/markdown/preview', ['markdown' => '**Step one**'])
            ->assertOk()
            ->assertJsonPath('data.html', "<p><strong>Step one</strong></p>\n");
    }

    public function test_an_empty_body_previews_as_nothing(): void
    {
        $this->seedRoles();

        $this->actingAs($this->userWithRole(RoleEnum::Editor))
            ->postJson('/api/v1/admin/markdown/preview', ['markdown' => ''])
            ->assertOk()
            ->assertJsonPath('data.html', '');
    }

    public function test_staff_who_write_nothing_are_refused(): void
    {
        $this->seedRoles();

        $this->actingAs($this->userWithRole(RoleEnum::Support))
            ->postJson('/api/v1/admin/markdown/preview', ['markdown' => 'x'])
            ->assertForbidden();
    }

    public function test_it_is_closed_to_anyone_not_signed_in(): void
    {
        $this->postJson('/api/v1/admin/markdown/preview', ['markdown' => 'x'])->assertUnauthorized();
    }
}
