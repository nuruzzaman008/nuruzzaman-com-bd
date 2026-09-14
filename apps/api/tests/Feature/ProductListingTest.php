<?php

namespace Tests\Feature;

use App\Enums\ProductType;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The public product list, which the products page asks for without courses. */
class ProductListingTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_products_page_can_leave_courses_out(): void
    {
        Product::factory()->ofType(ProductType::SoftwareLicense)->create(['name' => 'NB Engineering Tools', 'slug' => 'nb-engineering-tools']);
        Product::factory()->ofType(ProductType::CreditRefill)->create(['name' => 'NB Credit refill', 'slug' => 'nb-credit-refill']);
        Product::factory()->ofType(ProductType::Course)->create(['name' => 'AutoCAD Structural Drawing', 'slug' => 'autocad-structural-drawing']);

        $response = $this->getJson('/api/v1/products?exclude_type=course')->assertOk();

        $this->assertEqualsCanonicalizing(
            ['nb-engineering-tools', 'nb-credit-refill'],
            collect($response->json('data'))->pluck('slug')->all(),
        );
        $response->assertJsonPath('meta.total', 2);

        // Without it the list is unchanged, and a course is still reachable on its own.
        $this->assertCount(3, $this->getJson('/api/v1/products')->assertOk()->json('data'));
        $this->getJson('/api/v1/products/autocad-structural-drawing')->assertOk();
    }

    public function test_an_unknown_type_to_leave_out_is_refused(): void
    {
        $this->getJson('/api/v1/products?exclude_type=everything')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('exclude_type', 'error.fields');
    }
}
