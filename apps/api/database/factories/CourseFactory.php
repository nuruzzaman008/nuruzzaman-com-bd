<?php

namespace Database\Factories;

use App\Enums\ContentStatus;
use App\Models\Course;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Course> */
class CourseFactory extends Factory
{
    protected $model = Course::class;

    public function definition(): array
    {
        $title = fake()->sentence(4);

        return [
            'slug' => Str::slug($title).'-'.fake()->unique()->numberBetween(1, 99999),
            'title' => $title,
            'subtitle' => fake()->sentence(8),
            'description_markdown' => fake()->paragraphs(3, true),
            'status' => ContentStatus::Draft,
            'level' => 'beginner',
            'language' => 'Bangla',
            'sequential' => false,
            'pass_percentage' => 70,
            'issues_certificate' => true,
        ];
    }

    public function published(): static
    {
        return $this->state(fn () => [
            'status' => ContentStatus::Published,
            'published_at' => now()->subDay(),
        ]);
    }
}
