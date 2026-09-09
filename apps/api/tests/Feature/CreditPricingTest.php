<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreditPricingTest extends TestCase
{
    use RefreshDatabase;

    public function test_credit_prices_match_the_approved_document_and_preserve_history(): void
    {
        $product = Product::factory()->create(['slug' => 'nb-credit-refill', 'type' => 'credit_refill', 'is_price_public' => false]);
        $variant = $product->variants()->create(['sku' => 'NBC-500', 'name' => '500 credits', 'credit_amount' => 500, 'is_active' => true]);
        $old = $variant->prices()->create(['currency' => 'BDT', 'amount_minor' => 60000, 'is_active' => true]);
        $this->artisan('catalog:publish-credit-prices')->assertSuccessful();
        $this->artisan('catalog:publish-credit-prices')->assertSuccessful();
        $this->assertFalse($old->refresh()->is_active);
        $this->assertSame(2, $variant->prices()->count());
        foreach ([500 => 49900, 2000 => 149900, 5000 => 299900, 15000 => 699900] as $amount => $price) {
            $pack = $product->variants()->where('sku', 'NBC-'.$amount)->firstOrFail();
            $this->assertSame($amount, $pack->credit_amount);
            $this->assertSame($price, $pack->currentPrice()->amount_minor);
        }
        $this->actingAs($this->customer())->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])->assertCreated()->assertJsonPath('data.total_minor', 49900);
    }
}
