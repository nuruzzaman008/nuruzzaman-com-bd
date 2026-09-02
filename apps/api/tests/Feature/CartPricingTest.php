<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Price;
use App\Models\ProductVariant;
use App\Services\Commerce\CartService;
use App\Services\Commerce\PricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CartPricingTest extends TestCase
{
    use RefreshDatabase;

    public function test_totals_are_calculated_from_stored_prices(): void
    {
        $user = $this->customer();
        $variant = ProductVariant::factory()->create();
        Price::factory()->for($variant, 'variant')->amount(250000)->create();

        $this->actingAs($user)
            ->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 2])
            ->assertCreated()
            ->assertJsonPath('data.subtotal_minor', 500000)
            ->assertJsonPath('data.total_minor', 500000)
            ->assertJsonPath('data.is_purchasable', true);
    }

    public function test_a_variant_without_a_published_price_is_not_purchasable(): void
    {
        $user = $this->customer();
        $variant = ProductVariant::factory()->create();

        // No price row: the API must refuse rather than treat it as free.
        $this->actingAs($user)
            ->postJson('/api/v1/cart/items', ['variant_id' => $variant->id])
            ->assertStatus(422)
            ->assertJsonPath('error.message', 'This item does not have a published price yet.');
    }

    public function test_a_percentage_coupon_reduces_the_total(): void
    {
        $user = $this->customer();
        $variant = ProductVariant::factory()->create();
        Price::factory()->for($variant, 'variant')->amount(200000)->create();

        Coupon::create([
            'code' => 'LAUNCH20',
            'discount_type' => 'percent',
            'discount_value' => 20,
            'is_active' => true,
        ]);

        $this->actingAs($user)->postJson('/api/v1/cart/items', ['variant_id' => $variant->id]);

        $this->actingAs($user)
            ->postJson('/api/v1/cart/coupon', ['code' => 'launch20'])
            ->assertOk()
            ->assertJsonPath('data.discount_minor', 40000)
            ->assertJsonPath('data.total_minor', 160000);
    }

    public function test_an_expired_coupon_is_rejected(): void
    {
        $user = $this->customer();
        $variant = ProductVariant::factory()->create();
        Price::factory()->for($variant, 'variant')->create();

        Coupon::create([
            'code' => 'OLD',
            'discount_type' => 'percent',
            'discount_value' => 50,
            'is_active' => true,
            'ends_at' => now()->subDay(),
        ]);

        $this->actingAs($user)->postJson('/api/v1/cart/items', ['variant_id' => $variant->id]);

        $this->actingAs($user)
            ->postJson('/api/v1/cart/coupon', ['code' => 'OLD'])
            ->assertStatus(422);
    }

    public function test_tax_is_only_applied_once_a_rule_is_configured(): void
    {
        config()->set('nb.commerce.tax_percent', 5);

        $user = $this->customer();
        $variant = ProductVariant::factory()->create();
        Price::factory()->for($variant, 'variant')->amount(100000)->create();

        $cart = app(CartService::class)->addItem(
            app(CartService::class)->forUser($user),
            $variant,
        );

        $totals = app(PricingService::class)->totalsFor($cart, $user);

        $this->assertSame(5000, $totals->tax->minor);
        $this->assertSame(105000, $totals->total->minor);
    }

    public function test_an_anonymous_cart_merges_into_the_account_on_sign_in(): void
    {
        $this->seedRoles();

        $variant = ProductVariant::factory()->create();
        Price::factory()->for($variant, 'variant')->amount(100000)->create();

        $guest = $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id])->assertCreated();
        $token = $guest->json('data.token');

        $user = \App\Models\User::factory()->create(['email' => 'merge@example.com']);

        $this->withCookie('cart_token', $token)
            ->postJson('/api/v1/auth/login', ['email' => 'merge@example.com', 'password' => 'password'])
            ->assertOk();

        $this->actingAs($user->fresh())
            ->getJson('/api/v1/cart')
            ->assertOk()
            ->assertJsonPath('data.subtotal_minor', 100000);
    }
}
