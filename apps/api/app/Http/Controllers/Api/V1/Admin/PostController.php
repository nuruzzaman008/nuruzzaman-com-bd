<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PostRequest;
use App\Http\Resources\PostResource;
use App\Jobs\RevalidateFrontend;
use App\Models\Post;
use App\Models\PostRevision;
use App\Services\Content\PublishingService;
use App\Support\Audit;
use App\Support\ListFilters;
use App\Support\Markdown;
use App\Support\SearchTerm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class PostController extends Controller
{
    public function __construct(private readonly PublishingService $publishing) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Post::class);

        $validated = $request->validate([
            'status' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', ContentStatus::values())],
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'category' => ['sometimes', 'nullable', 'string', 'max:180'],
            'tag' => ['sometimes', 'nullable', 'string', 'max:180'],
            'month' => ['sometimes', 'nullable', 'string', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        /*
         * Everything except the status and the month, so the counts beside each
         * status and the months in the date filter describe the list the way it
         * is being searched rather than the whole archive.
         */
        $base = Post::query()
            ->when($validated['q'] ?? null, fn ($query, $term) => SearchTerm::titleOrSlug($query, $term, 'title'))
            ->when($validated['category'] ?? null, fn ($query, $slug) => $query->whereHas(
                'categories',
                fn ($categories) => $categories->where('slug', $slug),
            ))
            ->when($validated['tag'] ?? null, fn ($query, $slug) => $query->whereHas(
                'tags',
                fn ($tags) => $tags->where('slug', $slug),
            ));

        $month = $validated['month'] ?? null;

        $posts = ListFilters::month($base->clone(), $month)
            // cover and seo are what the dashboard list scores each post on.
            ->with(['author', 'categories', 'cover', 'seo'])
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->latest('id')
            ->paginate($validated['per_page'] ?? 20)
            ->withQueryString();

        return PostResource::collection($posts)->additional([
            'filters' => [
                'counts' => ListFilters::statusCounts(ListFilters::month($base->clone(), $month)),
                'months' => ListFilters::months($base->clone()),
            ],
        ]);
    }

    public function show(Post $post): PostResource
    {
        $this->authorize('view', $post);

        return new PostResource($post->load(['author', 'reviewer', 'cover', 'categories', 'tags', 'seo']));
    }

    public function store(PostRequest $request): PostResource
    {
        $this->authorize('create', Post::class);

        $post = DB::transaction(function () use ($request) {
            $post = Post::create($this->attributes($request) + [
                'status' => ContentStatus::Draft,
                'created_by' => $request->user()->getKey(),
                'updated_by' => $request->user()->getKey(),
            ]);

            $this->syncRelations($post, $request);

            return $post;
        });

        return new PostResource($post->load(['author', 'categories', 'tags', 'seo']));
    }

    public function update(PostRequest $request, Post $post): PostResource
    {
        $this->authorize('update', $post);

        $previousSlug = $post->slug;

        DB::transaction(function () use ($request, $post) {
            $this->publishing->snapshot($post, $request->user(), 'Auto-snapshot before edit');

            $post->update($this->attributes($request) + [
                'updated_by' => $request->user()->getKey(),
                'content_updated_at' => now(),
            ]);

            $this->syncRelations($post, $request);
        });

        $post = $post->fresh();

        // A published article is edited in place, so its cached page has to be
        // dropped on save - not only on publish - or readers keep seeing the
        // old text until the cache runs out. The old address too, if it moved.
        RevalidateFrontend::dispatch(array_values(array_unique([
            ...$this->publishing->tagsFor($post),
            'post:'.$previousSlug,
        ])));

        return new PostResource($post->load(['author', 'categories', 'tags', 'seo']));
    }

    public function transition(Request $request, Post $post): PostResource
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', ContentStatus::values())],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $target = ContentStatus::from($validated['status']);

        $this->authorize(
            in_array($target, [ContentStatus::Published, ContentStatus::Scheduled], true) ? 'publish' : 'update',
            $post,
        );

        $this->publishing->transition($post, $target, $request->user(), $validated['note'] ?? null);

        return new PostResource($post->fresh()->load(['author', 'categories', 'tags', 'seo']));
    }

    public function revisions(Post $post): JsonResponse
    {
        $this->authorize('view', $post);

        return response()->json([
            'data' => $post->revisions()->with('creator:id,name')->limit(50)->get()
                ->map(fn (PostRevision $revision) => [
                    'revision' => $revision->revision,
                    'title' => $revision->title,
                    'status' => $revision->status,
                    'note' => $revision->note,
                    'by' => $revision->creator?->name,
                    'at' => $revision->created_at?->toIso8601String(),
                ]),
        ]);
    }

    public function restore(Request $request, Post $post, int $revision): PostResource
    {
        $this->authorize('update', $post);

        $target = $post->revisions()->where('revision', $revision)->firstOrFail();

        return new PostResource($this->publishing->restore($post, $target, $request->user()));
    }

    public function destroy(Post $post): JsonResponse
    {
        $this->authorize('delete', $post);

        $slug = $post->slug;
        $wasPublished = $post->status === ContentStatus::Published;

        $post->delete();

        Audit::record('post.deleted', $post, ['slug' => $slug, 'was_published' => $wasPublished]);

        // A deleted article has to leave the site now, not when the pages
        // happen to be built again: its own page, the lists it was in, and
        // the sitemap that still names it.
        RevalidateFrontend::dispatch([...$this->publishing->tagsFor($post), 'post:'.$slug]);

        return response()->json(['message' => 'Post moved to trash.']);
    }

    private function attributes(PostRequest $request): array
    {
        $data = $request->safe()->except(['category_ids', 'tag_ids', 'seo']);

        /*
         * An empty body reaches here as null - Laravel converts empty fields -
         * and a new article starts empty on purpose, while the column is not
         * nullable. Only touched when the caller actually sent a body: a save
         * that leaves it out must keep the article that is already written.
         */
        if (array_key_exists('body_markdown', $data)) {
            $data['body_markdown'] ??= '';
            $data['reading_minutes'] = Markdown::readingMinutes($data['body_markdown']);
        }

        return $data;
    }

    private function syncRelations(Post $post, PostRequest $request): void
    {
        if ($request->has('category_ids')) {
            $post->categories()->sync($request->validated('category_ids') ?? []);
        }

        if ($request->has('tag_ids')) {
            $post->tags()->sync($request->validated('tag_ids') ?? []);
        }

        if ($request->has('seo')) {
            $post->seo()->updateOrCreate([], $request->validated('seo'));
        }
    }
}
