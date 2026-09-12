<?php

namespace Tests\Feature;

use App\Enums\Role as RoleEnum;
use App\Models\Post;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Whether a focus keyword is already spoken for.
 *
 * Two of our own pages written for one phrase compete with each other, and the
 * editor has no way to notice that on its own.
 */
class SeoKeywordUsageTest extends TestCase
{
    use RefreshDatabase;

    private function ask(array $query): \Illuminate\Testing\TestResponse
    {
        return $this->getJson('/api/v1/admin/seo/keyword-usage?'.http_build_query($query));
    }

    public function test_it_names_the_records_already_using_a_keyword(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);

        $post = Post::factory()->create(['title' => 'পাঞ্চিং শিয়ার হিসাব']);
        $post->seo()->create(['focus_keyword' => 'punching shear']);

        $product = Product::factory()->create();

        $this->actingAs($admin)
            ->ask(['keyword' => 'punching shear', 'kind' => 'product', 'id' => $product->id])
            ->assertOk()
            ->assertJsonCount(1, 'data.used_by')
            ->assertJsonPath('data.used_by.0.title', 'পাঞ্চিং শিয়ার হিসাব')
            ->assertJsonPath('data.used_by.0.type', 'Post');
    }

    public function test_a_record_is_not_reported_as_clashing_with_itself(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);

        $product = Product::factory()->create();
        $product->seo()->create(['focus_keyword' => 'autocad tools']);

        $this->actingAs($admin)
            ->ask(['keyword' => 'autocad tools', 'kind' => 'product', 'id' => $product->id])
            ->assertOk()
            ->assertJsonCount(0, 'data.used_by');
    }

    public function test_the_match_ignores_case_and_surrounding_space(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);

        $post = Post::factory()->create(['title' => 'A guide']);
        $post->seo()->create(['focus_keyword' => 'Punching Shear']);

        $this->actingAs($admin)
            ->ask(['keyword' => '  punching shear  '])
            ->assertOk()
            ->assertJsonCount(1, 'data.used_by');
    }

    public function test_an_unrelated_keyword_comes_back_empty(): void
    {
        $this->seedRoles();
        $admin = $this->userWithRole(RoleEnum::Admin);

        $post = Post::factory()->create();
        $post->seo()->create(['focus_keyword' => 'something else']);

        $this->actingAs($admin)
            ->ask(['keyword' => 'punching shear'])
            ->assertOk()
            ->assertJsonCount(0, 'data.used_by');
    }

    public function test_a_customer_cannot_read_the_keyword_map(): void
    {
        $this->seedRoles();
        $customer = $this->userWithRole(RoleEnum::Customer);

        $this->actingAs($customer)
            ->ask(['keyword' => 'punching shear'])
            ->assertForbidden();
    }

    public function test_it_is_closed_to_anyone_not_signed_in(): void
    {
        $this->ask(['keyword' => 'punching shear'])->assertUnauthorized();
    }
}
