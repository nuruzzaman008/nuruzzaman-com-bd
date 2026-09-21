<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Dashboard -> Users: when each account was created, newest first. */
class AdminUserListTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_list_says_when_each_account_was_created_newest_first(): void
    {
        $this->travelTo(now()->subDays(3));
        $older = $this->customer();
        $this->travelBack();
        $newer = $this->customer();
        $owner = $this->userWithRole(RoleEnum::SuperAdmin);

        $rows = collect(
            $this->actingAs($owner)->getJson('/api/v1/admin/users')->assertOk()->json('data'),
        )->keyBy('id');

        $this->assertSame($older->created_at->toIso8601String(), $rows[$older->id]['created_at']);
        $this->assertSame($newer->created_at->toIso8601String(), $rows[$newer->id]['created_at']);

        $ids = $rows->keys()->all();
        $this->assertLessThan(array_search($older->id, $ids, true), array_search($newer->id, $ids, true));
    }
}
