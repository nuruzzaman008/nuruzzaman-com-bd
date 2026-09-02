<?php

namespace Database\Factories;

use App\Enums\ContentStatus;
use App\Enums\ProductType;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Product> */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        $name = fake()->unique()->words(3, true);

        return [
            'slug' => Str::slug($name),
            'type' => ProductType::DigitalResource,
            'name' => Str::title($name),
            'tagline' => fake()->sentence(8),
            'description_markdown' => fake()->paragraphs(2, true),
            'status' => ContentStatus::Published,
            'is_price_public' => true,
            'published_at' => now()->subDay(),
        ];
    }

    public function ofType(ProductType $type): static
    {
        return $this->state(fn () => ['type' => $type]);
    }
}
