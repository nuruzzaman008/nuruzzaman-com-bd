<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\ProductType;
use App\Enums\Role;
use App\Models\Course;
use App\Models\Post;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** The search box above the admin products, courses and blog posts lists: title or URL slug. */
class AdminListSearchTest extends TestCase
{
    use RefreshDatabase;

    /** @return list<string> */
    private function slugs(TestResponse $response): array
    {
        return collect($response->assertOk()->json('data'))->pluck('slug')->sort()->values()->all();
    }

    public function test_products_are_found_by_name_or_by_slug(): void
    {
        Product::factory()->create(['name' => 'NB Engineering Tools', 'slug' => 'nb-engineering-tools']);
        Product::factory()->ofType(ProductType::CreditRefill)->create(['name' => 'NB Credit refill', 'slug' => 'nb-credit-refill']);
        Product::factory()->create(['name' => 'Basic bullet 01', 'slug' => 'basic-english-sound']);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->assertSame(['nb-credit-refill'], $this->slugs($this->getJson('/api/v1/admin/products?q=credit')));
        $this->assertSame(['nb-engineering-tools'], $this->slugs($this->getJson('/api/v1/admin/products?q=engineering-tools')));
        // A title typed in words finds the slug made from those words.
        $this->assertSame(['basic-english-sound'], $this->slugs($this->getJson('/api/v1/admin/products?q='.urlencode('Basic English Sound'))));
        // No search, or an empty one, lists everything.
        $this->assertCount(3, $this->slugs($this->getJson('/api/v1/admin/products')));
        $this->assertCount(3, $this->slugs($this->getJson('/api/v1/admin/products?q=')));
    }

    public function test_courses_are_found_by_title_or_by_a_slug_copied_from_the_list(): void
    {
        Course::factory()->create(['title' => 'AutoCAD Structural Drawing', 'slug' => 'autocad-structural-drawing']);
        Course::factory()->create(['title' => 'বেসিক ইংরেজি সাউন্ড', 'slug' => 'basic-english-sound']);
        Course::factory()->create(['title' => 'Septic Tank Design', 'slug' => 'septic-tank-design']);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->assertSame(['autocad-structural-drawing'], $this->slugs($this->getJson('/api/v1/admin/courses?q=structural')));
        $this->assertSame(['basic-english-sound'], $this->slugs($this->getJson('/api/v1/admin/courses?q='.urlencode('/basic-english-sound'))));
        // A Bengali title has no slug form; it must still narrow the list, not match everything.
        $this->assertSame(['basic-english-sound'], $this->slugs($this->getJson('/api/v1/admin/courses?q='.urlencode('ইংরেজি'))));
    }

    public function test_blog_posts_are_found_by_slug_as_well_as_title_and_keep_the_status_filter(): void
    {
        Post::factory()->create(['title' => 'How to design a septic tank', 'slug' => 'septic-tank-guide', 'status' => ContentStatus::Draft]);
        Post::factory()->published()->create(['title' => 'Column design notes', 'slug' => 'column-notes']);
        Post::factory()->create(['title' => 'Column schedule', 'slug' => 'column-schedule', 'status' => ContentStatus::Draft]);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->assertSame(['septic-tank-guide'], $this->slugs($this->getJson('/api/v1/admin/posts?q=tank-guide')));
        $this->assertSame(['column-notes', 'column-schedule'], $this->slugs($this->getJson('/api/v1/admin/posts?q=column')));
        $this->assertSame(['column-schedule'], $this->slugs($this->getJson('/api/v1/admin/posts?q=column&status=draft')));
    }

    public function test_percent_and_underscore_are_searched_for_literally(): void
    {
        Course::factory()->create(['title' => 'Concrete mix', 'slug' => 'concrete-mix']);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->assertSame([], $this->slugs($this->getJson('/api/v1/admin/courses?q=%25')));
        $this->assertSame([], $this->slugs($this->getJson('/api/v1/admin/courses?q=_')));
    }

    public function test_the_admin_products_list_can_leave_course_listings_out(): void
    {
        Product::factory()->ofType(ProductType::SoftwareLicense)->create(['name' => 'NB Engineering Tools', 'slug' => 'nb-engineering-tools']);
        Product::factory()->ofType(ProductType::Course)->create(['name' => 'AutoCAD course', 'slug' => 'course-autocad']);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $this->assertSame(['course-autocad', 'nb-engineering-tools'], $this->slugs($this->getJson('/api/v1/admin/products')));
        $this->assertSame(['nb-engineering-tools'], $this->slugs($this->getJson('/api/v1/admin/products?exclude_type=course')));
        $this->assertSame([], $this->slugs($this->getJson('/api/v1/admin/products?exclude_type=course&q=autocad')));
    }

    public function test_only_staff_can_search_the_admin_lists(): void
    {
        Product::factory()->create();

        $this->actingAs($this->customer())->getJson('/api/v1/admin/products?q=nb')->assertForbidden();
        $this->getJson('/api/v1/admin/courses?q=nb')->assertForbidden();
    }
}
