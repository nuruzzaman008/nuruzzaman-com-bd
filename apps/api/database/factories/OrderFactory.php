<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use App\Support\Reference;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Order> */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        return [
            'number' => Reference::order(),
            'user_id' => User::factory(),
            'status' => OrderStatus::PendingPayment,
            'currency' => 'BDT',
            'subtotal_minor' => 500000,
            'total_minor' => 500000,
            'billing_name' => fake()->name(),
            'billing_email' => fake()->safeEmail(),
            'placed_at' => now(),
        ];
    }

    public function paid(): static
    {
        return $this->state(fn () => ['status' => OrderStatus::Paid, 'paid_at' => now()]);
    }
}
