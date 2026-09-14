<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EngineeringToolsPriceTest extends TestCase
{
    use RefreshDatabase;

    public function test_licences_are_priced_as_approved_preserving_history_and_idempotent(): void
    {
        $product = Product::factory()->create(['slug' => 'nb-engineering-tools', 'type' => 'software_license', 'is_price_public' => false]);
        $single = ProductVariant::factory()->create(['product_id' => $product->id, 'sku' => 'NBET-V6-SINGLE']);
        $old = $single->prices()->create(['currency' => 'BDT', 'amount_minor' => 1059900, 'is_active' => true]);

        $this->artisan('catalog:price-engineering-tools')->assertSuccessful();
        $this->artisan('catalog:price-engineering-tools')->assertSuccessful();

        // The single-PC launch price, shown against the regular price.
        $this->assertFalse($old->refresh()->is_active);
        $this->assertSame(2, $single->prices()->count());
        $price = $single->fresh()->currentPrice();
        $this->assertSame(499000, $price->amount_minor);
        $this->assertSame(790000, $price->compare_at_minor);
        $this->assertEquals(1, $single->fresh()->device_limit);

        // Office packs: one licence for several computers, which activation enforces.
        foreach (['NBET-V6-OFFICE-3' => [3, 1990000], 'NBET-V6-OFFICE-5' => [5, 2990000]] as $sku => [$devices, $amount]) {
            $pack = $product->variants()->where('sku', $sku)->firstOrFail();
            $this->assertEquals($devices, $pack->device_limit);
            $this->assertTrue($pack->is_active);
            $this->assertSame(1, $pack->prices()->count());
            $this->assertSame($amount, $pack->currentPrice()->amount_minor);
            $this->assertNull($pack->currentPrice()->compare_at_minor);
        }

        $this->assertTrue($product->refresh()->is_price_public);

        $office = $product->variants()->where('sku', 'NBET-V6-OFFICE-5')->firstOrFail();
        $this->actingAs($this->customer())
            ->postJson('/api/v1/cart/items', ['variant_id' => $office->id, 'quantity' => 1])
            ->assertCreated()
            ->assertJsonPath('data.total_minor', 2990000);
    }

    public function test_missing_catalogue_is_not_created_or_overwritten(): void
    {
        $this->artisan('catalog:price-engineering-tools')->assertFailed();
        $this->assertDatabaseCount('product_variants', 0);
        $this->assertDatabaseCount('prices', 0);
    }
}
