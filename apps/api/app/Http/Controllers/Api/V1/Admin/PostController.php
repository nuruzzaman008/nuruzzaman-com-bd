<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PostRequest;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Models\PostRevision;
use App\Services\Content\PublishingService;
use App\Support\Markdown;
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
            'status' => ['sometimes', 'string', 'in:'.implode(',', ContentStatus::values())],
            'q' => ['sometimes', 'string', 'max:120'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $posts = Post::query()
            ->with(['author', 'categories'])
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['q'] ?? null, fn ($query, $term) => $query->where('title', 'like', '%'.$term.'%'))
            ->latest('id')
            ->paginate($validated['per_page'] ?? 20);

        return PostResource::collection($posts);
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

        DB::transaction(function () use ($request, $post) {
            $this->publishing->snapshot($post, $request->user(), 'Auto-snapshot before edit');

            $post->update($this->attributes($request) + [
                'updated_by' => $request->user()->getKey(),
                'content_updated_at' => now(),
            ]);

            $this->syncRelations($post, $request);
        });

        return new PostResource($post->fresh()->load(['author', 'categories', 'tags', 'seo']));
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

        $post->delete();

        return response()->json(['message' => 'Post moved to trash.']);
    }

    private function attributes(PostRequest $request): array
    {
        $data = $request->safe()->except(['category_ids', 'tag_ids', 'seo']);
        $data['reading_minutes'] = Markdown::readingMinutes($request->validated('body_markdown'));

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
