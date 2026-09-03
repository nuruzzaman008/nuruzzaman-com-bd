<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    public function test_registration_creates_a_customer_and_signs_in(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Rafiq Hasan',
            'email' => 'rafiq@example.com',
            'password' => 'correct-horse-42',
            'password_confirmation' => 'correct-horse-42',
            'accepts_terms' => true,
        ]);

        $response->assertCreated()->assertJsonPath('data.email', 'rafiq@example.com');

        $user = User::query()->where('email', 'rafiq@example.com')->firstOrFail();

        $this->assertTrue($user->hasRole(RoleEnum::Customer));
        $this->assertAuthenticatedAs($user);
    }

    public function test_registration_requires_accepting_the_terms(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Rafiq Hasan',
            'email' => 'rafiq@example.com',
            'password' => 'correct-horse-42',
            'password_confirmation' => 'correct-horse-42',
        ])->assertStatus(422)->assertJsonPath('error.code', 'validation_failed');
    }

    public function test_login_rejects_wrong_credentials_with_the_shared_error_shape(): void
    {
        User::factory()->create(['email' => 'rafiq@example.com']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'rafiq@example.com',
            'password' => 'not-the-password',
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'validation_failed')
            ->assertJsonStructure(['error' => ['code', 'message', 'fields']]);
    }

    public function test_a_suspended_account_cannot_sign_in(): void
    {
        User::factory()->create(['email' => 'rafiq@example.com', 'status' => 'suspended']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'rafiq@example.com',
            'password' => 'password',
        ])->assertStatus(422);

        $this->assertGuest();
    }

    public function test_forgot_password_never_reveals_whether_an_account_exists(): void
    {
        $known = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.com']);
        $known->assertOk();

        User::factory()->create(['email' => 'real@example.com']);
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'real@example.com'])
            ->assertOk()
            ->assertJson($known->json());
    }

    public function test_account_endpoints_require_authentication(): void
    {
        $this->getJson('/api/v1/me')->assertStatus(401)->assertJsonPath('error.code', 'unauthenticated');
        $this->getJson('/api/v1/account/orders')->assertStatus(401);
    }

    /**
     * The Next.js proxy decides whether to render a private page or redirect to
     * sign-in by looking for this exact cookie name. If Laravel renames it, the
     * front end sends every signed-in visitor back to the login page, which is
     * a total lockout that no API-level test would otherwise catch.
     */
    public function test_the_session_cookie_is_the_name_the_front_end_looks_for(): void
    {
        $this->assertSame('nuruzzaman_session', config('session.cookie'));
    }

    /**
     * The hosting runs MySQL, the schema is written for it, and AppServiceProvider
     * refuses to boot on anything else. This asserts the suite itself is on the
     * same engine, so a MySQL-only problem cannot hide behind a green run on some
     * other driver.
     */
    public function test_the_suite_runs_on_mysql(): void
    {
        $this->assertContains(
            \DB::connection()->getDriverName(),
            ['mysql', 'mariadb'],
        );
    }
}
