<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Production readiness pass of 17 September 2026: the site header's session
 * check, sign-in outside the website, and what a 404 gives away.
 */
class SessionEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_signed_out_visitor_gets_200_with_no_user(): void
    {
        $this->getJson('/api/v1/session')
            ->assertOk()
            ->assertExactJson(['data' => null]);
    }

    public function test_a_signed_in_customer_gets_their_own_user(): void
    {
        $user = $this->customer(['email' => 'rafiq@example.com']);

        $this->actingAs($user)
            ->getJson('/api/v1/session')
            ->assertOk()
            ->assertJsonPath('data.email', 'rafiq@example.com');
    }

    public function test_an_inactive_account_is_shown_as_signed_out(): void
    {
        $user = $this->customer(['status' => 'suspended']);

        $this->actingAs($user)
            ->getJson('/api/v1/session')
            ->assertOk()
            ->assertExactJson(['data' => null]);
    }

    public function test_registering_outside_the_website_creates_no_account(): void
    {
        Notification::fake();
        $this->seedRoles();

        $this->withoutHeader('Origin')
            ->postJson('/api/v1/auth/register', [
                'name' => 'Rafiq Hasan',
                'phone' => '01712345678',
                'email' => 'bot@example.com',
                'password' => 'correct-horse-42',
                'password_confirmation' => 'correct-horse-42',
                'accepts_terms' => true,
            ])
            ->assertStatus(400);

        $this->assertFalse(User::query()->where('email', 'bot@example.com')->exists());
    }

    public function test_signing_in_outside_the_website_is_refused_before_the_password_is_checked(): void
    {
        $this->customer(['email' => 'rafiq@example.com']);

        $this->withoutHeader('Origin')
            ->postJson('/api/v1/auth/login', [
                'email' => 'rafiq@example.com',
                'password' => 'password',
            ])
            ->assertStatus(400);
    }

    public function test_a_missing_record_does_not_name_the_model(): void
    {
        $response = $this->getJson('/api/v1/posts/does-not-exist')->assertNotFound();

        $response->assertJsonPath('error.message', 'The requested resource was not found.');
        $this->assertStringNotContainsString('App\\Models', $response->getContent());
    }
}
