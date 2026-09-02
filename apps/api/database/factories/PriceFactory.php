<?php

namespace Database\Factories;

use App\Models\Price;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Price> */
class PriceFactory extends Factory
{
    protected $model = Price::class;

    public function definition(): array
    {
        return [
            'product_variant_id' => ProductVariant::factory(),
            'currency' => 'BDT',
            // Minor units: 500000 == 5,000.00 BDT.
            'amount_minor' => 500000,
            'is_active' => true,
        ];
    }

    public function amount(int $minor): static
    {
        return $this->state(fn () => ['amount_minor' => $minor]);
    }
}
