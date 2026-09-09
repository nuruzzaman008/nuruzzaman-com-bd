<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EngineeringToolsPriceTest extends TestCase
{
    use RefreshDatabase;

    public function test_offer_preserves_history_and_is_idempotent(): void
    {
        $product = Product::factory()->create(['slug' => 'nb-engineering-tools', 'type' => 'software_license', 'is_price_public' => false]);
        $variant = ProductVariant::factory()->create(['product_id' => $product->id, 'sku' => 'NBET-V6-SINGLE']);
        $old = $variant->prices()->create(['currency' => 'BDT', 'amount_minor' => 1059900, 'is_active' => true]);
        $this->artisan('catalog:price-engineering-tools')->assertSuccessful();
        $this->artisan('catalog:price-engineering-tools')->assertSuccessful();
        $this->assertFalse($old->refresh()->is_active);
        $this->assertSame(2, $variant->prices()->count());
        $price = $variant->fresh()->currentPrice();
        $this->assertSame(559900, $price->amount_minor);
        $this->assertSame(1059900, $price->compare_at_minor);
        $this->assertTrue($product->refresh()->is_price_public);
    }

    public function test_missing_catalogue_is_not_created_or_overwritten(): void
    {
        $this->artisan('catalog:price-engineering-tools')->assertFailed();
        $this->assertDatabaseCount('prices', 0);
    }
}
