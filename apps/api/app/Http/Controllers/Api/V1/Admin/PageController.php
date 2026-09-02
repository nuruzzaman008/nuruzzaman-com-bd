<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PageRequest;
use App\Http\Resources\PageResource;
use App\Models\Page;
use App\Services\Content\PublishingService;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PageController extends Controller
{
    public function __construct(private readonly PublishingService $publishing) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Page::class);

        return PageResource::collection(Page::query()->orderBy('slug')->paginate(50));
    }

    public function show(Page $page): PageResource
    {
        $this->authorize('view', $page);

        return new PageResource($page->load('seo'));
    }

    public function store(PageRequest $request): PageResource
    {
        $this->authorize('create', Page::class);

        $page = Page::create($request->safe()->except('seo') + [
            'status' => ContentStatus::Draft,
            'updated_by' => $request->user()->getKey(),
        ]);

        if ($request->has('seo')) {
            $page->seo()->updateOrCreate([], $request->validated('seo'));
        }

        return new PageResource($page->load('seo'));
    }

    public function update(PageRequest $request, Page $page): PageResource
    {
        $this->authorize('update', $page);

        $page->update($request->safe()->except('seo') + ['updated_by' => $request->user()->getKey()]);

        if ($request->has('seo')) {
            $page->seo()->updateOrCreate([], $request->validated('seo'));
        }

        return new PageResource($page->fresh()->load('seo'));
    }

    public function transition(Request $request, Page $page): PageResource
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', ContentStatus::values())],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $target = ContentStatus::from($validated['status']);
        $this->authorize($target === ContentStatus::Published ? 'publish' : 'update', $page);

        $this->publishing->transition($page, $target, $request->user(), $validated['note'] ?? null);

        return new PageResource($page->fresh()->load('seo'));
    }

    /**
     * Records that a qualified professional has reviewed a legal page. Until
     * this is set, the public page keeps its visible DRAFT notice.
     */
    public function recordLegalReview(Request $request, Page $page): PageResource
    {
        $this->authorize('publish', $page);

        $validated = $request->validate([
            'reviewer' => ['required', 'string', 'max:160'],
            'reviewed' => ['required', 'boolean'],
        ]);

        $page->update([
            'legal_reviewed' => $validated['reviewed'],
            'legal_reviewer' => $validated['reviewed'] ? $validated['reviewer'] : null,
            'legal_reviewed_at' => $validated['reviewed'] ? now() : null,
        ]);

        Audit::record('page.legal_review_recorded', $page, $validated);

        return new PageResource($page->fresh()->load('seo'));
    }

    public function destroy(Page $page): JsonResponse
    {
        $this->authorize('delete', $page);

        $page->delete();

        return response()->json(['message' => 'Page moved to trash.']);
    }
}
