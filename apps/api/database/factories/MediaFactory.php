<?php

namespace Database\Factories;

use App\Models\Media;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Media> */
class MediaFactory extends Factory
{
    protected $model = Media::class;

    public function definition(): array
    {
        return [
            'disk' => 'public',
            'path' => 'uploads/test/'.fake()->uuid().'.webp',
            'original_name' => 'example.webp',
            'mime_type' => 'image/webp',
            'size_bytes' => 120000,
            'width' => 1200,
            'height' => 675,
            'alt_text' => fake()->sentence(5),
        ];
    }
}
