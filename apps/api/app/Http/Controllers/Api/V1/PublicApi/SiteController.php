<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Page;
use App\Models\Post;
use App\Models\Product;
use App\Models\Redirect;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SiteController extends Controller
{
    /**
     * Everything the frontend needs to render honest UI without inventing
     * values: only keys the owner has actually configured are returned.
     */
    public function settings(): JsonResponse
    {
        $site = config('nb.site');

        return response()->json([
            'data' => [
                'name' => $site['name'],
                'url' => $site['url'],
                'locale' => $site['locale'],
                'timezone' => $site['timezone'],
                'currency' => $site['currency'],
                'support_email' => $site['support_email'],
                'support_hours' => $site['support_hours'],
                'phone' => $site['phone'],
                'business_address' => $site['business_address'],
                'legal_entity' => $site['legal_entity'],
                'legal_reviewed' => (bool) config('nb.legal.reviewed'),
                'product' => [
                    'designed_for' => config('nb.product.designed_for'),
                    'tested_autocad_versions' => config('nb.product.tested_autocad_versions'),
                    'installer_sha256' => config('nb.product.installer_sha256'),
                    'code_signing_status' => config('nb.product.code_signing_status'),
                ],
                'analytics' => [
                    'ga4_id' => config('nb.analytics.ga4_id'),
                    'search_console_verification' => config('nb.analytics.search_console_verification'),
                ],
                'overrides' => Setting::publicMap(),
            ],
        ]);
    }

    /** Feeds app/sitemap.ts. Only genuinely indexable URLs are listed. */
    public function sitemap(): JsonResponse
    {
        return response()->json([
            'data' => [
                'posts' => Post::query()->published()
                    ->select('slug', 'published_at', 'content_updated_at')
                    ->orderByDesc('published_at')->get()
                    ->map(fn (Post $post) => [
                        'slug' => $post->slug,
                        'updated_at' => ($post->content_updated_at ?? $post->published_at)?->toIso8601String(),
                    ]),
                // The `-en` documents are translations of a page that is
                // already listed, not pages of their own: they are served at the
                // /en URL of their Bengali counterpart, so listing their slug
                // would advertise a URL that does not exist.
                'pages' => Page::query()->published()
                    ->where('slug', 'not like', '%-en')
                    ->select('slug', 'updated_at')->get()
                    ->map(fn (Page $page) => [
                        'slug' => $page->slug,
                        'updated_at' => $page->updated_at?->toIso8601String(),
                    ]),
                'products' => Product::query()->published()
                    ->select('slug', 'updated_at')->get()
                    ->map(fn (Product $product) => [
                        'slug' => $product->slug,
                        'updated_at' => $product->updated_at?->toIso8601String(),
                    ]),
                'courses' => Course::query()->published()
                    ->select('courses.slug', 'courses.updated_at')->get()
                    ->map(fn (Course $course) => [
                        'slug' => $course->slug,
                        'updated_at' => $course->updated_at?->toIso8601String(),
                    ]),
            ],
        ]);
    }

    /** Consumed by the Next.js proxy so 301s survive a content migration. */
    public function redirects(): JsonResponse
    {
        return response()->json([
            'data' => Redirect::query()
                ->where('is_active', true)
                ->select('source_path', 'destination_path', 'status_code')
                ->get(),
        ]);
    }

    public function resolveRedirect(Request $request): JsonResponse
    {
        $path = '/'.ltrim((string) $request->query('path', ''), '/');

        $redirect = Redirect::query()
            ->where('is_active', true)
            ->where('source_path', $path)
            ->first();

        if (! $redirect) {
            return response()->json(['data' => null]);
        }

        $redirect->increment('hits');
        $redirect->update(['last_hit_at' => now()]);

        return response()->json([
            'data' => [
                'destination_path' => $redirect->destination_path,
                'status_code' => $redirect->status_code,
            ],
        ]);
    }
}
