<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Http\Resources\PostSummaryResource;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PostController extends Controller
{
    /** Allowlisted sorts; anything else falls back to newest first. */
    private const SORTS = [
        'newest' => ['published_at', 'desc'],
        'oldest' => ['published_at', 'asc'],
        'title' => ['title', 'asc'],
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'category' => ['sometimes', 'string', 'max:120'],
            'tag' => ['sometimes', 'string', 'max:120'],
            'author' => ['sometimes', 'string', 'max:120'],
            'q' => ['sometimes', 'string', 'max:120'],
            'sort' => ['sometimes', 'string'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        [$column, $direction] = self::SORTS[$validated['sort'] ?? 'newest'] ?? self::SORTS['newest'];

        $posts = Post::query()
            ->published()
            ->with(['author.photo', 'cover', 'categories'])
            ->when($validated['category'] ?? null, fn ($query, $slug) => $query
                ->whereHas('categories', fn ($inner) => $inner->where('slug', $slug)))
            ->when($validated['tag'] ?? null, fn ($query, $slug) => $query
                ->whereHas('tags', fn ($inner) => $inner->where('slug', $slug)))
            ->when($validated['author'] ?? null, fn ($query, $slug) => $query
                ->whereHas('author', fn ($inner) => $inner->where('slug', $slug)))
            ->when($validated['q'] ?? null, fn ($query, $term) => $query->where(fn ($inner) => $inner
                ->where('title', 'like', '%'.$term.'%')
                ->orWhere('excerpt', 'like', '%'.$term.'%')))
            ->orderBy($column, $direction)
            ->paginate($validated['per_page'] ?? 12)
            ->withQueryString();

        return PostSummaryResource::collection($posts);
    }

    public function show(string $slug): PostResource
    {
        $post = Post::query()
            ->published()
            ->where('slug', $slug)
            ->with(['author.photo', 'reviewer', 'cover', 'categories', 'tags', 'seo.ogImage'])
            ->withCount('approvedComments')
            // Averaged over approved comments that actually carry a rating:
            // a comment without one must not drag the average toward zero.
            ->withAvg(['approvedComments as rating_average' => fn ($query) => $query
                ->whereNotNull('rating')], 'rating')
            ->withCount(['approvedComments as rated_count' => fn ($query) => $query
                ->whereNotNull('rating')])
            ->firstOrFail();

        return new PostResource($post);
    }

    /** Related reading for the end of an article, by shared category. */
    public function related(string $slug): AnonymousResourceCollection
    {
        $post = Post::query()->published()->where('slug', $slug)->with('categories')->firstOrFail();
        $categoryIds = $post->categories->pluck('id');

        $related = Post::query()
            ->published()
            ->whereKeyNot($post->getKey())
            ->when($categoryIds->isNotEmpty(), fn ($query) => $query
                ->whereHas('categories', fn ($inner) => $inner->whereIn('categories.id', $categoryIds)))
            ->with(['author', 'cover', 'categories'])
            ->orderByDesc('published_at')
            ->limit(3)
            ->get();

        return PostSummaryResource::collection($related);
    }
}
