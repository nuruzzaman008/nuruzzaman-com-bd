<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Post;
use App\Models\Product;
use App\Support\RequestLocale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Internal search across published content only. Results are noindex on the
 * frontend, so this endpoint never becomes an indexable surface.
 *
 * Searching matches BOTH languages whatever `locale` says, and only the result
 * text follows the locale. An English reader who types a Bengali term found
 * nothing before, which is the wrong answer on a site whose articles are
 * written in Bengali.
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
            ->where(fn ($query) => $query
                ->where('title', 'like', $term)
                ->orWhere('title_en', 'like', $term)
                ->orWhere('excerpt', 'like', $term)
                ->orWhere('excerpt_en', 'like', $term))
            ->orderByDesc('published_at')->limit(8)
            ->get(['slug', 'title', 'title_en', 'excerpt', 'excerpt_en']);

        $courses = Course::query()->published()
            ->where(fn ($query) => $query
                ->where('courses.title', 'like', $term)
                ->orWhere('courses.title_en', 'like', $term)
                ->orWhere('courses.subtitle', 'like', $term)
                ->orWhere('courses.subtitle_en', 'like', $term))
            ->limit(5)
            ->get(['courses.slug', 'courses.title', 'courses.title_en', 'courses.subtitle', 'courses.subtitle_en']);

        $products = Product::query()->published()
            ->where(fn ($query) => $query
                ->where('name', 'like', $term)
                ->orWhere('name_en', 'like', $term)
                ->orWhere('tagline', 'like', $term)
                ->orWhere('tagline_en', 'like', $term))
            ->limit(5)
            ->get(['slug', 'name', 'name_en', 'tagline', 'tagline_en']);

        return response()->json([
            'data' => [
                'query' => $validated['q'],
                'posts' => $posts->map(fn ($post) => [
                    'slug' => $post->slug,
                    'title' => RequestLocale::pick($request, $post->title, $post->title_en),
                    'excerpt' => RequestLocale::pick($request, $post->excerpt, $post->excerpt_en),
                ]),
                'courses' => $courses->map(fn ($course) => [
                    'slug' => $course->slug,
                    'title' => RequestLocale::pick($request, $course->title, $course->title_en),
                    'excerpt' => RequestLocale::pick($request, $course->subtitle, $course->subtitle_en),
                ]),
                'products' => $products->map(fn ($product) => [
                    'slug' => $product->slug,
                    'title' => RequestLocale::pick($request, $product->name, $product->name_en),
                    'excerpt' => RequestLocale::pick($request, $product->tagline, $product->tagline_en),
                ]),
            ],
        ]);
    }
}
