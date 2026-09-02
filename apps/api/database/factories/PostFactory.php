<?php

namespace Database\Factories;

use App\Enums\ContentStatus;
use App\Models\Author;
use App\Models\Post;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Post> */
class PostFactory extends Factory
{
    protected $model = Post::class;

    public function definition(): array
    {
        $title = fake()->sentence(6);

        return [
            'slug' => Str::slug($title).'-'.fake()->unique()->numberBetween(1, 99999),
            'title' => $title,
            'excerpt' => fake()->sentence(14),
            'body_markdown' => "## ".fake()->sentence(4)."\n\n".fake()->paragraphs(4, true),
            'status' => ContentStatus::Draft,
            'author_id' => Author::factory(),
            'reading_minutes' => 4,
        ];
    }

    public function published(): static
    {
        return $this->state(fn () => [
            'status' => ContentStatus::Published,
            'published_at' => now()->subDay(),
            'content_updated_at' => now()->subDay(),
        ]);
    }
}
