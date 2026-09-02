<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<ProductVariant> */
class ProductVariantFactory extends Factory
{
    protected $model = ProductVariant::class;

    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'sku' => strtoupper(Str::random(4)).'-'.fake()->unique()->numberBetween(1000, 99999),
            'name' => fake()->words(2, true),
            'is_active' => true,
            'position' => 0,
        ];
    }
}
