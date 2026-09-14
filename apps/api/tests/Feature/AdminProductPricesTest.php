<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Changing licence and NB Credit prices from the admin dashboard. */
class AdminProductPricesTest extends TestCase
{
    use RefreshDatabase;

    private function credits(): array
    {
        $product = Product::factory()->create(['slug' => 'nb-credit-refill', 'type' => 'credit_refill']);
        $variant = $product->variants()->create(['sku' => 'NBC-500', 'name' => '500 NB Credits', 'credit_amount' => 500, 'is_active' => true, 'position' => 1]);

        return [$product, $variant];
    }

    private function pricesUrl(Product $product, ProductVariant $variant): string
    {
        return "/api/v1/admin/products/{$product->id}/variants/{$variant->id}/prices";
    }

    public function test_a_new_price_is_shown_on_the_site_and_the_old_one_is_kept(): void
    {
        [$product, $variant] = $this->credits();
        $old = $variant->prices()->create(['currency' => 'BDT', 'amount_minor' => 49900, 'is_active' => true, 'starts_at' => now()->subDay()]);

        $this->actingAs($this->userWithRole(Role::SuperAdmin))
            ->postJson($this->pricesUrl($product, $variant), ['amount_minor' => 59900, 'compare_at_minor' => 69900])
            ->assertCreated();

        $this->assertFalse($old->refresh()->is_active);
        $this->assertNotNull($old->ends_at);
        $this->assertSame(2, $variant->prices()->count());

        $this->getJson('/api/v1/products/nb-credit-refill')
            ->assertOk()
            ->assertJsonPath('data.variants.0.price.amount_minor', 59900)
            ->assertJsonPath('data.variants.0.price.compare_at_minor', 69900)
            ->assertJsonPath('data.variants.0.is_purchasable', true);
    }

    public function test_the_regular_price_has_to_be_higher_than_the_price(): void
    {
        [$product, $variant] = $this->credits();

        $this->actingAs($this->userWithRole(Role::SuperAdmin))
            ->postJson($this->pricesUrl($product, $variant), ['amount_minor' => 59900, 'compare_at_minor' => 50000])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('compare_at_minor', 'error.fields');

        $this->assertSame(0, $variant->prices()->count());
    }

    public function test_the_dashboard_sees_switched_off_packs_and_can_switch_them_back_on(): void
    {
        [$product] = $this->credits();
        $off = $product->variants()->create(['sku' => 'NBC-1000', 'name' => '1,000 NB Credits', 'credit_amount' => 1000, 'is_active' => false, 'position' => 2]);

        $this->actingAs($this->userWithRole(Role::SuperAdmin));

        $variants = collect($this->getJson("/api/v1/admin/products/{$product->id}")->assertOk()->json('data.all_variants'));
        $this->assertEqualsCanonicalizing(['NBC-500', 'NBC-1000'], $variants->pluck('sku')->all());
        $this->assertFalse($variants->firstWhere('sku', 'NBC-1000')['is_active']);

        $this->patchJson("/api/v1/admin/products/{$product->id}/variants/{$off->id}", ['is_active' => true])->assertOk();
        $this->assertTrue($off->refresh()->is_active);
    }

    public function test_customers_cannot_change_prices_or_packs(): void
    {
        [$product, $variant] = $this->credits();

        $this->actingAs($this->customer())
            ->postJson($this->pricesUrl($product, $variant), ['amount_minor' => 100])
            ->assertForbidden();
        $this->patchJson("/api/v1/admin/products/{$product->id}/variants/{$variant->id}", ['is_active' => false])
            ->assertForbidden();

        $this->assertSame(0, $variant->prices()->count());
        $this->assertTrue($variant->refresh()->is_active);
    }
}
