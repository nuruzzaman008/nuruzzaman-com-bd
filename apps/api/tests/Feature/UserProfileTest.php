<?php

namespace Tests\Feature;

use App\Enums\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UserProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_uploads_private_photo_and_admin_views_and_edits_profile(): void
    {
        Storage::fake('private');
        $user = $this->customer();
        $this->actingAs($user);
        $file = UploadedFile::fake()->createWithContent('photo.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='));
        $this->postJson('/api/v1/me/avatar', ['photo' => $file])->assertOk()->assertJsonPath('data.profile.has_photo', true)->assertJsonMissingPath('data.profile.avatar_path');
        $this->get('/api/v1/me/avatar')->assertOk()->assertHeader('Content-Type', 'image/png');
        $path = $user->fresh()->profile->avatar_path;
        Storage::disk('private')->assertExists($path);
        $this->postJson('/api/v1/me/avatar', ['photo' => UploadedFile::fake()->create('bad.svg', 1, 'image/svg+xml')])->assertUnprocessable();
        $this->postJson('/api/v1/me/avatar', ['photo' => UploadedFile::fake()->create('big.jpg', 5121, 'image/jpeg')])->assertUnprocessable();
        $this->assertSame($path, $user->fresh()->profile->avatar_path);
        $this->actingAs($this->customer())->getJson('/api/v1/admin/users/'.$user->id.'/avatar')->assertForbidden();
        $this->actingAs($this->userWithRole(Role::SuperAdmin));
        $this->get('/api/v1/admin/users/'.$user->id.'/avatar')->assertOk();
        $this->patchJson('/api/v1/admin/users/'.$user->id, ['name' => 'Updated Name', 'phone' => '01712345678', 'profile' => ['organization' => 'Test Office', 'district' => 'Dhaka', 'avatar_path' => 'untrusted']])->assertOk()->assertJsonPath('data.profile.organization', 'Test Office');
        $this->assertSame($path, $user->fresh()->profile->avatar_path);
        $this->actingAs($user)->patchJson('/api/v1/me', ['name' => 'My Name', 'phone' => '01712345678', 'profile' => ['bio' => 'Engineer']])->assertOk()->assertJsonPath('data.profile.bio', 'Engineer');
    }
}
