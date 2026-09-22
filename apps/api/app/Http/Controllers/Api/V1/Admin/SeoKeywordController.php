<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Page;
use App\Models\SeoMeta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Who else is already targeting a focus keyword.
 *
 * Two of our own pages written for the same phrase compete with each other:
 * search engines pick one, usually not the one we would have chosen, and the
 * other's links and authority are wasted. The editor asks here before an
 * author commits to a keyword, so the answer has to be live rather than
 * computed once when the page was rendered.
 *
 * Only the titles of the clashing records come back — enough to recognise
 * them, and nothing that is not already visible in the admin lists.
 */
class SeoKeywordController extends Controller
{
    /** The kinds an editor can ask about, and what they are stored as. */
    private const KINDS = [
        'post' => \App\Models\Post::class,
        'page' => \App\Models\Page::class,
        'product' => \App\Models\Product::class,
        'course' => \App\Models\Course::class,
    ];

    public function __invoke(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()?->hasPermission('posts.view')
            || $request->user()?->hasPermission('pages.view')
            || $request->user()?->hasPermission('products.view')
            || $request->user()?->hasPermission('courses.view'),
            403,
        );

        $validated = $request->validate([
            'keyword' => ['required', 'string', 'max:160'],
            // The record doing the asking, so it does not report itself. The
            // caller names a kind rather than a class, so the frontend never
            // has to know what a model is called on this side.
            'kind' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::KINDS))],
            'id' => ['nullable', 'integer'],
        ]);

        $keyword = trim($validated['keyword']);

        if ($keyword === '') {
            return response()->json(['data' => ['used_by' => []]]);
        }

        $self = isset($validated['kind'], $validated['id'])
            ? [self::KINDS[$validated['kind']], $validated['id']]
            : null;

        // A page's own translation (about and about-en) is the same page in the
        // other language, served at its /en address with hreflang - not a
        // second page competing for the phrase.
        $translation = $self !== null && $validated['kind'] === 'page'
            ? $this->translationOf((int) $validated['id'])
            : null;

        $rows = SeoMeta::query()
            ->whereRaw('LOWER(focus_keyword) = ?', [mb_strtolower($keyword)])
            ->when(
                $self !== null,
                fn ($query) => $query->whereNot(
                    fn ($inner) => $inner
                        ->where('seoable_type', $self[0])
                        ->where('seoable_id', $self[1]),
                ),
            )
            ->when(
                $translation !== null,
                fn ($query) => $query->whereNot(
                    fn ($inner) => $inner
                        ->where('seoable_type', Page::class)
                        ->where('seoable_id', $translation),
                ),
            )
            ->with('seoable')
            ->limit(10)
            ->get();

        return response()->json([
            'data' => [
                'used_by' => $rows
                    // A record whose owner has since been deleted leaves its
                    // seo row behind; it is not a clash with anything.
                    ->filter(fn (SeoMeta $row) => $row->seoable !== null)
                    ->map(fn (SeoMeta $row) => [
                        'type' => class_basename($row->seoable_type),
                        'id' => $row->seoable_id,
                        'title' => $row->seoable->title ?? $row->seoable->name ?? $row->meta_title,
                    ])
                    ->values(),
            ],
        ]);
    }

    /** The id of the other-language document of a page, if it has one. */
    private function translationOf(int $pageId): ?int
    {
        $slug = Page::query()->whereKey($pageId)->value('slug');

        if (! is_string($slug)) {
            return null;
        }

        $pair = str_ends_with($slug, '-en') ? substr($slug, 0, -3) : $slug.'-en';
        $id = Page::query()->where('slug', $pair)->value('id');

        return $id === null ? null : (int) $id;
    }
}
