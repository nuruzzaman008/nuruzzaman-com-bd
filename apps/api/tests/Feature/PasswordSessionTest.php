<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

/**
 * Changing a password ends the sessions that were signed in with the old one,
 * and leaves the session doing the changing alone. Hardening pass of
 * 21 September 2026.
 */
class PasswordSessionTest extends TestCase
{
    use RefreshDatabase;

    private const OLD = 'correct-horse-42';

    private const NEW = 'battery-staple-77';

    /** What a session signed in before the change carries. */
    private function staleSession(User $user): array
    {
        return ['password_hash_web' => $user->getAuthPassword()];
    }

    public function test_changing_the_password_keeps_this_session_and_ends_the_others(): void
    {
        $user = $this->customer(['password' => self::OLD]);
        $before = $this->staleSession($user);

        $this->actingAs($user)
            ->postJson('/api/v1/me/password', [
                'current_password' => self::OLD,
                'password' => self::NEW,
                'password_confirmation' => self::NEW,
            ])
            ->assertOk();

        // The device that changed it carries on.
        $this->actingAs($user->fresh())->getJson('/api/v1/me')->assertOk();

        // A session signed in with the old password no longer works.
        $this->withSession($before)
            ->actingAs($user->fresh())
            ->getJson('/api/v1/me')
            ->assertStatus(401);
    }

    public function test_the_wrong_current_password_changes_nothing(): void
    {
        $user = $this->customer(['password' => self::OLD]);

        $this->actingAs($user)
            ->postJson('/api/v1/me/password', [
                'current_password' => 'not-the-password',
                'password' => self::NEW,
                'password_confirmation' => self::NEW,
            ])
            ->assertStatus(422);

        $this->assertTrue(password_verify(self::OLD, $user->fresh()->password));
    }

    public function test_resetting_the_password_ends_every_session(): void
    {
        Notification::fake();
        Event::fake([PasswordReset::class]);

        $user = $this->customer(['password' => self::OLD]);
        $before = $this->staleSession($user);
        $token = Password::broker()->createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => self::NEW,
            'password_confirmation' => self::NEW,
        ])->assertOk();

        $this->withSession($before)
            ->actingAs($user->fresh())
            ->getJson('/api/v1/me')
            ->assertStatus(401);
    }

    public function test_a_session_from_this_password_is_left_alone(): void
    {
        $user = $this->customer(['password' => self::OLD]);

        // Nothing changed, so a session carrying the current hash still works.
        $this->withSession($this->staleSession($user))
            ->actingAs($user)
            ->getJson('/api/v1/me')
            ->assertOk();
    }
}
