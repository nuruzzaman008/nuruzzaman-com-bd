<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Post;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Internal search across published content only. Results are noindex on the
 * frontend, so this endpoint never becomes an indexable surface.
 */
class SearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:120'],
        ]);

        $term = '%'.str_replace(['%', '_'], ['\%', '\_'], $validated['q']).'%';

        $posts = Post::query()->published()
            ->where(fn ($query) => $query->where('title', 'like', $term)->orWhere('excerpt', 'like', $term))
            ->orderByDesc('published_at')->limit(8)
            ->get(['slug', 'title', 'excerpt']);

        $courses = Course::query()->published()
            ->where(fn ($query) => $query->where('title', 'like', $term)->orWhere('subtitle', 'like', $term))
            ->limit(5)
            ->get(['courses.slug', 'courses.title', 'courses.subtitle']);

        $products = Product::query()->published()
            ->where(fn ($query) => $query->where('name', 'like', $term)->orWhere('tagline', 'like', $term))
            ->limit(5)
            ->get(['slug', 'name', 'tagline']);

        return response()->json([
            'data' => [
                'query' => $validated['q'],
                'posts' => $posts->map(fn ($post) => [
                    'slug' => $post->slug, 'title' => $post->title, 'excerpt' => $post->excerpt,
                ]),
                'courses' => $courses->map(fn ($course) => [
                    'slug' => $course->slug, 'title' => $course->title, 'excerpt' => $course->subtitle,
                ]),
                'products' => $products->map(fn ($product) => [
                    'slug' => $product->slug, 'title' => $product->name, 'excerpt' => $product->tagline,
                ]),
            ],
        ]);
    }
}
