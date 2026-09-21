<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Mail\TwoFactorResetMail;
use App\Models\User;
use App\Support\Totp;
use App\Support\TwoFactor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Super admins and admins clearing another staff member's two-step
 * verification from the dashboard, and everybody else not being able to.
 */
class StaffTwoFactorResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();
    }

    /** A staff account with an authenticator and recovery codes. */
    private function protectedStaff(RoleEnum $role): User
    {
        $user = $this->userWithRole($role);
        TwoFactor::generateRecoveryCodes($user);

        return $user->fresh();
    }

    /** The code the actor's own phone shows right now. */
    private function codeOf(User $actor, int $offset = 0): string
    {
        return Totp::at((string) $actor->fresh()->mfa_secret, Totp::currentStep() + $offset);
    }

    private function reset(User $actor, User $target, ?string $code = null): TestResponse
    {
        return $this->actingAs($actor)->postJson(
            '/api/v1/admin/users/'.$target->getKey().'/mfa/reset',
            ['code' => $code ?? $this->codeOf($actor)],
        );
    }

    private function assertUntouched(User $target): void
    {
        $fresh = $target->fresh();
        $this->assertTrue($fresh->hasTwoFactor());
        $this->assertSame(8, TwoFactor::remainingRecoveryCodes($fresh));
    }

    public function test_a_super_admin_resets_an_admin_and_the_admin_is_told(): void
    {
        $owner = $this->userWithRole(RoleEnum::SuperAdmin);
        $admin = $this->protectedStaff(RoleEnum::Admin);

        $this->reset($owner, $admin)
            ->assertOk()
            ->assertJsonPath('data.id', $admin->getKey())
            ->assertJsonPath('data.mfa_enabled', false);

        $fresh = $admin->fresh();
        $this->assertFalse($fresh->hasTwoFactor());
        $this->assertNull($fresh->mfa_secret);
        $this->assertNull($fresh->mfa_recovery_codes);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'auth.mfa_reset_by_staff',
            'auditable_id' => $admin->getKey(),
            'user_id' => $owner->getKey(),
        ]);
        Mail::assertQueued(TwoFactorResetMail::class, fn (TwoFactorResetMail $mail) => $mail->hasTo($admin->email)
            && $mail->resetBy === $owner->name);
    }

    public function test_after_a_reset_the_dashboard_asks_them_to_set_it_up_again(): void
    {
        $owner = $this->userWithRole(RoleEnum::SuperAdmin);
        $admin = $this->protectedStaff(RoleEnum::Admin);

        $this->actingAs($admin)->getJson('/api/v1/admin/orders')->assertOk();

        $this->reset($owner, $admin)->assertOk();

        $this->actingAs($admin->fresh())->getJson('/api/v1/admin/orders')->assertStatus(403);
        $this->actingAs($admin->fresh())->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.mfa_enabled', false);
        $this->actingAs($admin->fresh())->postJson('/api/v1/me/mfa')->assertOk();
    }

    public function test_an_admin_resets_other_staff_including_another_admin(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);

        foreach ([RoleEnum::Editor, RoleEnum::Instructor, RoleEnum::Support, RoleEnum::Admin] as $role) {
            $target = $this->protectedStaff($role);

            $this->reset($admin, $target)->assertOk();
            $this->assertFalse($target->fresh()->hasTwoFactor(), $role->value);

            // Each code works once; stand in for the thirty seconds until the
            // phone shows the next one.
            $admin->forceFill(['mfa_last_used_step' => null])->save();
        }
    }

    public function test_an_admin_cannot_reset_a_super_admin(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $owner = $this->protectedStaff(RoleEnum::SuperAdmin);

        $this->reset($admin, $owner)->assertStatus(403);

        $this->assertUntouched($owner);
        Mail::assertNothingQueued();
    }

    public function test_a_super_admin_can_reset_another_super_admin(): void
    {
        $owner = $this->userWithRole(RoleEnum::SuperAdmin);
        $other = $this->protectedStaff(RoleEnum::SuperAdmin);

        $this->reset($owner, $other)->assertOk();
        $this->assertFalse($other->fresh()->hasTwoFactor());
    }

    public function test_other_staff_cannot_reset_anyone(): void
    {
        $target = $this->protectedStaff(RoleEnum::Support);

        foreach ([RoleEnum::Editor, RoleEnum::Instructor, RoleEnum::Support] as $role) {
            $this->reset($this->userWithRole($role), $target)->assertStatus(403);
        }

        $this->assertUntouched($target);
    }

    public function test_nobody_resets_their_own_this_way(): void
    {
        $owner = $this->protectedStaff(RoleEnum::SuperAdmin);

        $this->reset($owner, $owner)->assertStatus(403);
        $this->assertUntouched($owner);
    }

    public function test_customer_accounts_are_not_reset_from_here(): void
    {
        $owner = $this->userWithRole(RoleEnum::SuperAdmin);
        $customer = $this->customer();
        $customer->forceFill(['mfa_secret' => Totp::generateSecret(), 'mfa_confirmed_at' => now()])->save();

        $this->reset($owner, $customer)->assertStatus(403);
        $this->assertTrue($customer->fresh()->hasTwoFactor());
    }

    public function test_it_needs_the_resetter_s_own_current_code(): void
    {
        $owner = $this->userWithRole(RoleEnum::SuperAdmin);
        $admin = $this->protectedStaff(RoleEnum::Admin);

        // No code, a wrong code, and the target's code rather than their own.
        $this->actingAs($owner)->postJson('/api/v1/admin/users/'.$admin->getKey().'/mfa/reset', [])->assertStatus(422);
        $this->reset($owner, $admin, '000000')->assertStatus(422);
        $this->reset($owner, $admin, $this->codeOf($admin))->assertStatus(422);

        $this->assertUntouched($admin);
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.mfa_failed', 'user_id' => $owner->getKey()]);
    }

    public function test_three_wrong_codes_lock_it_and_a_used_code_does_not_work_twice(): void
    {
        $owner = $this->userWithRole(RoleEnum::SuperAdmin);
        $first = $this->protectedStaff(RoleEnum::Admin);
        $second = $this->protectedStaff(RoleEnum::Editor);

        $code = $this->codeOf($owner);
        $this->reset($owner, $first, $code)->assertOk();
        // The same code again, for somebody else.
        $this->reset($owner, $second, $code)->assertStatus(422);

        $this->reset($owner, $second, '000000')->assertStatus(422);
        $this->reset($owner, $second, '111111')->assertStatus(422);
        // Locked: the next real code is refused too.
        $this->reset($owner, $second, $this->codeOf($owner, 1))->assertStatus(422);

        $this->assertUntouched($second);
    }

    /** A session that never typed a code is stopped before the controller. */
    public function test_a_session_without_the_resetter_s_own_code_is_refused(): void
    {
        $owner = $this->userWithRole(RoleEnum::SuperAdmin);
        $admin = $this->protectedStaff(RoleEnum::Admin);

        $this->be($owner)
            ->postJson('/api/v1/admin/users/'.$admin->getKey().'/mfa/reset', ['code' => $this->codeOf($owner)])
            ->assertStatus(403);

        $this->assertUntouched($admin);
    }

    public function test_the_response_carries_no_secret(): void
    {
        $owner = $this->userWithRole(RoleEnum::SuperAdmin);
        $admin = $this->protectedStaff(RoleEnum::Admin);
        $secret = (string) $admin->mfa_secret;

        $body = $this->reset($owner, $admin)->assertOk()->getContent();

        $this->assertStringNotContainsString($secret, $body);
        $this->assertStringNotContainsString('"mfa_secret":', $body);
        $this->assertStringNotContainsString('"mfa_recovery_codes":', $body);
    }
}
