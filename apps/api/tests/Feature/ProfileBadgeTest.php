<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\User;
use App\Support\ProfileBadge;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The blue badge beside a name: a verified email, a complete profile and a
 * photo, worked out on the server.
 */
class ProfileBadgeTest extends TestCase
{
    use RefreshDatabase;

    private const COMPLETE = [
        'display_name' => 'Engr. Rahim',
        'headline' => 'Structural engineer',
        'organization' => 'NB Consultant',
        'designation' => 'Senior engineer',
        'district' => 'Dhaka',
        'bio' => 'Designs reinforced concrete buildings.',
        'avatar_path' => 'profile-photos/rahim.jpg',
    ];

    private function complete(array $user = [], array $profile = []): User
    {
        $person = $this->customer($user + ['name' => 'Rahim Uddin', 'phone' => '+8801711000000', 'email_verified_at' => now()]);
        $person->profile()->updateOrCreate(['user_id' => $person->id], $profile + self::COMPLETE);

        return $person->fresh('profile');
    }

    public function test_a_verified_complete_profile_with_a_photo_earns_the_badge(): void
    {
        $person = $this->complete();

        $this->assertTrue(ProfileBadge::earned($person));
        $this->assertSame([], ProfileBadge::missing($person));
    }

    public function test_each_missing_piece_is_named_in_form_order(): void
    {
        $person = $this->complete(
            ['email_verified_at' => null, 'phone' => null],
            ['avatar_path' => null, 'designation' => '   ', 'bio' => ''],
        );

        $this->assertFalse(ProfileBadge::earned($person));
        $this->assertSame(['email_verified', 'photo', 'phone', 'designation', 'bio'], ProfileBadge::missing($person));
    }

    public function test_an_account_with_no_profile_yet_needs_everything_but_its_name(): void
    {
        $person = $this->customer(['name' => 'New Person', 'phone' => null, 'email_verified_at' => null])->fresh('profile');

        $this->assertSame(
            ['email_verified', 'photo', 'phone', 'display_name', 'headline', 'organization', 'designation', 'district', 'bio'],
            ProfileBadge::missing($person),
        );
    }

    public function test_the_dashboard_user_page_and_list_carry_the_badge(): void
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $done = $this->complete();
        $half = $this->complete([], ['district' => null]);

        $this->actingAs($admin)->getJson("/api/v1/admin/users/{$done->id}")
            ->assertOk()
            ->assertJsonPath('data.verified_badge', true)
            ->assertJsonPath('data.badge_missing', []);
        $this->actingAs($admin)->getJson("/api/v1/admin/users/{$half->id}")
            ->assertOk()
            ->assertJsonPath('data.verified_badge', false)
            ->assertJsonPath('data.badge_missing', ['district']);

        $list = collect($this->actingAs($admin)->getJson('/api/v1/admin/users')->assertOk()->json('data'))->keyBy('id');
        $this->assertTrue($list[$done->id]['verified_badge']);
        $this->assertFalse($list[$half->id]['verified_badge']);
    }

    public function test_the_owner_sees_their_own_badge_and_cannot_set_it(): void
    {
        $person = $this->complete([], ['headline' => null]);

        $this->actingAs($person)->getJson('/api/v1/me')->assertOk()
            ->assertJsonPath('data.verified_badge', false)
            ->assertJsonPath('data.badge_missing', ['headline']);

        // Sending the flag does nothing; filling the field does.
        $this->actingAs($person)->patchJson('/api/v1/me', [
            'name' => 'Rahim Uddin', 'phone' => '+8801711000000', 'verified_badge' => true,
            'profile' => ['headline' => 'Structural engineer'],
        ])->assertOk()->assertJsonPath('data.verified_badge', true);
    }
}
