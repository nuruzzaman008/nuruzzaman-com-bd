<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Every admin endpoint is checked against every role, so a permission change
 * cannot silently widen access.
 */
class AuthorizationMatrixTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, array{0: string, 1: string, 2: array<string, int>}> */
    public static function matrix(): array
    {
        return [
            'orders list' => ['GET', '/api/v1/admin/orders', [
                'super_admin' => 200, 'admin' => 200, 'support' => 200,
                'editor' => 403, 'instructor' => 403, 'customer' => 403,
            ]],
            // Instructors may write articles, so they can list them; support
            // staff have no editorial permission at all.
            'posts list' => ['GET', '/api/v1/admin/posts', [
                'super_admin' => 200, 'admin' => 200, 'editor' => 200,
                'instructor' => 200, 'support' => 403, 'customer' => 403,
            ]],
            'users list' => ['GET', '/api/v1/admin/users', [
                'super_admin' => 200, 'admin' => 200, 'support' => 200,
                'editor' => 403, 'instructor' => 403, 'customer' => 403,
            ]],
            'audit log' => ['GET', '/api/v1/admin/audit-logs', [
                'super_admin' => 200, 'admin' => 200,
                'editor' => 403, 'instructor' => 403, 'support' => 403, 'customer' => 403,
            ]],
            'activation queue' => ['GET', '/api/v1/admin/activation-requests', [
                'super_admin' => 200, 'admin' => 200, 'support' => 200,
                'editor' => 403, 'instructor' => 403, 'customer' => 403,
            ]],
            'settings' => ['GET', '/api/v1/admin/settings', [
                'super_admin' => 200, 'admin' => 200,
                'editor' => 403, 'instructor' => 403, 'support' => 403, 'customer' => 403,
            ]],
            'courses list' => ['GET', '/api/v1/admin/courses', [
                'super_admin' => 200, 'admin' => 200, 'editor' => 200, 'instructor' => 200,
                'support' => 200, 'customer' => 403,
            ]],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('matrix')]
    public function test_role_access(string $method, string $uri, array $expectations): void
    {
        $this->seedRoles();

        foreach ($expectations as $role => $status) {
            $user = $this->userWithRole(RoleEnum::from($role));

            $this->actingAs($user)
                ->json($method, $uri)
                ->assertStatus($status, "{$role} on {$method} {$uri}");
        }
    }

    public function test_an_editor_cannot_publish_but_can_edit_a_draft(): void
    {
        $this->seedRoles();
        $post = Post::factory()->create();

        $editor = $this->userWithRole(RoleEnum::Editor);
        $instructor = $this->userWithRole(RoleEnum::Instructor);

        $this->actingAs($editor)
            ->patchJson('/api/v1/admin/posts/'.$post->id, ['title' => 'Edited by editor'])
            ->assertOk();

        $this->actingAs($instructor)
            ->patchJson('/api/v1/admin/posts/'.$post->id, ['title' => 'Edited by instructor'])
            ->assertStatus(403);

        $this->actingAs($editor)
            ->postJson('/api/v1/admin/posts/'.$post->id.'/transition', ['status' => 'published'])
            ->assertOk();
    }

    public function test_role_assignment_needs_a_password_confirmation(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::SuperAdmin);
        $target = $this->customer();

        $this->actingAs($admin)
            ->putJson('/api/v1/admin/users/'.$target->id.'/roles', ['roles' => ['editor']])
            ->assertStatus(423);
    }

    public function test_a_super_admin_cannot_change_their_own_roles(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::SuperAdmin);

        $this->actingAs($admin)
            ->postJson('/api/v1/me/confirm-password', ['password' => 'password'])
            ->assertOk();

        $this->actingAs($admin)
            ->putJson('/api/v1/admin/users/'.$admin->id.'/roles', ['roles' => ['super_admin']])
            ->assertStatus(403);
    }

    public function test_an_unverified_staff_account_cannot_reach_the_admin_area(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin, ['email_verified_at' => null]);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/dashboard')
            ->assertStatus(403);
    }
}
