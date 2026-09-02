<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Price;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    private function cartWithItem(int $amountMinor = 350000): array
    {
        $user = $this->customer();
        $variant = ProductVariant::factory()->create();
        Price::factory()->for($variant, 'variant')->amount($amountMinor)->create();

        $this->actingAs($user)->postJson('/api/v1/cart/items', ['variant_id' => $variant->id])->assertCreated();

        return [$user, $variant];
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Rafiq Hasan',
            'email' => 'rafiq@example.com',
            'accepts_terms' => true,
            'accepts_privacy' => true,
            'accepts_refund_policy' => true,
        ], $overrides);
    }

    public function test_checkout_creates_a_pending_order_priced_on_the_server(): void
    {
        [$user] = $this->cartWithItem(350000);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/checkout', $this->payload())
            ->assertCreated();

        $order = Order::query()->firstOrFail();

        $this->assertSame(OrderStatus::PendingPayment, $order->status);
        $this->assertSame(350000, $order->total_minor);
        $this->assertNotEmpty($response->json('data.redirect_url'));
        $this->assertSame(['terms', 'privacy', 'refund_policy'], $order->accepted_terms);
    }

    public function test_a_total_sent_by_the_browser_is_ignored(): void
    {
        [$user] = $this->cartWithItem(350000);

        $this->actingAs($user)
            ->postJson('/api/v1/checkout', $this->payload([
                'total_minor' => 1,
                'subtotal_minor' => 1,
                'discount_minor' => 349999,
            ]))
            ->assertCreated();

        $this->assertSame(350000, Order::query()->firstOrFail()->total_minor);
    }

    public function test_checkout_requires_every_policy_acceptance(): void
    {
        [$user] = $this->cartWithItem();

        $this->actingAs($user)
            ->postJson('/api/v1/checkout', $this->payload(['accepts_refund_policy' => false]))
            ->assertStatus(422)
            ->assertJsonPath('error.fields.accepts_refund_policy.0', 'Please accept the refund policy.');
    }

    public function test_an_empty_cart_cannot_be_checked_out(): void
    {
        $user = $this->customer();

        $this->actingAs($user)
            ->postJson('/api/v1/checkout', $this->payload())
            ->assertStatus(422);
    }

    public function test_the_same_idempotency_key_replays_instead_of_creating_a_second_order(): void
    {
        [$user] = $this->cartWithItem();

        $first = $this->actingAs($user)
            ->withHeader('Idempotency-Key', 'checkout-key-0001')
            ->postJson('/api/v1/checkout', $this->payload())
            ->assertCreated();

        $second = $this->actingAs($user)
            ->withHeader('Idempotency-Key', 'checkout-key-0001')
            ->postJson('/api/v1/checkout', $this->payload())
            ->assertCreated();

        $this->assertSame($first->json('data.order.number'), $second->json('data.order.number'));
        $this->assertSame(1, Order::query()->count());
    }

    public function test_reusing_an_idempotency_key_with_a_different_body_is_a_conflict(): void
    {
        [$user] = $this->cartWithItem();

        $this->actingAs($user)
            ->withHeader('Idempotency-Key', 'checkout-key-0002')
            ->postJson('/api/v1/checkout', $this->payload())
            ->assertCreated();

        $this->actingAs($user)
            ->withHeader('Idempotency-Key', 'checkout-key-0002')
            ->postJson('/api/v1/checkout', $this->payload(['name' => 'Someone Else']))
            ->assertStatus(409);
    }
}
