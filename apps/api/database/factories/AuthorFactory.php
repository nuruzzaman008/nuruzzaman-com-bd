<?php

namespace Database\Factories;

use App\Models\Author;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Author> */
class AuthorFactory extends Factory
{
    protected $model = Author::class;

    public function definition(): array
    {
        $name = fake()->name();

        return [
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1, 99999),
            'name' => $name,
            'credentials' => 'RSE',
            'headline' => fake()->sentence(6),
            'bio' => fake()->paragraph(),
            'is_reviewer' => true,
        ];
    }
}
