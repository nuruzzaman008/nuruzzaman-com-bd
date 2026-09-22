<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PageRequest;
use App\Http\Resources\PageResource;
use App\Jobs\RevalidateFrontend;
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

        // With their SEO, so the list can show each page's SEO score.
        return PageResource::collection(Page::query()->with('seo.ogImage')->orderBy('slug')->paginate(50));
    }

    public function show(Page $page): PageResource
    {
        $this->authorize('view', $page);

        return new PageResource($page->load('seo.ogImage'));
    }

    public function store(PageRequest $request): PageResource
    {
        $this->authorize('create', Page::class);

        $page = Page::create($this->attributes($request) + [
            'status' => ContentStatus::Draft,
            'updated_by' => $request->user()->getKey(),
        ]);

        if ($request->has('seo')) {
            $this->saveSeo($page, $request->validated('seo'));
        }

        Audit::record('page.created', $page, ['slug' => $page->slug]);

        return new PageResource($page->load('seo.ogImage'));
    }

    public function update(PageRequest $request, Page $page): PageResource
    {
        $this->authorize('update', $page);

        $previousSlug = $page->slug;

        $page->update($this->attributes($request) + ['updated_by' => $request->user()->getKey()]);

        if ($request->has('seo')) {
            $this->saveSeo($page, $request->validated('seo'));
        }

        // The words only, not the body itself: the audit log says who changed
        // what, and a policy's full text would bury everything else in it.
        Audit::record('page.updated', $page, ['fields' => array_keys($request->validated())]);

        // A live page is cached; without this, readers keep the old words until
        // the cache runs out. The old address too, if it moved.
        $this->refresh($page, $previousSlug);

        return new PageResource($page->fresh()->load('seo.ogImage'));
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

        return new PageResource($page->fresh()->load('seo.ogImage'));
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

        // The DRAFT notice on the live page comes and goes with this.
        $this->refresh($page);

        return new PageResource($page->fresh()->load('seo.ogImage'));
    }

    public function destroy(Page $page): JsonResponse
    {
        $this->authorize('delete', $page);

        $page->delete();

        Audit::record('page.deleted', $page, ['slug' => $page->slug]);
        $this->refresh($page);

        return response()->json(['message' => 'Page moved to trash.']);
    }

    /** @return array<string, mixed> */
    private function attributes(PageRequest $request): array
    {
        $data = $request->safe()->except('seo');

        // An emptied body arrives as null, but the column holds text.
        if (array_key_exists('body_markdown', $data)) {
            $data['body_markdown'] ??= '';
        }

        return $data;
    }

    /**
     * An English document (`about-en`) is read with ?locale=en, and the SEO
     * resource answers an English request from the `_en` columns, so its own
     * title and description go there as well as in the plain ones.
     *
     * @param  array<string, mixed>  $seo
     */
    private function saveSeo(Page $page, array $seo): void
    {
        if (str_ends_with($page->slug, '-en')) {
            foreach (['meta_title', 'meta_description'] as $field) {
                if (array_key_exists($field, $seo)) {
                    $seo[$field.'_en'] = $seo[$field];
                }
            }
        }

        $page->seo()->updateOrCreate([], $seo);
    }

    private function refresh(Page $page, ?string $previousSlug = null): void
    {
        RevalidateFrontend::dispatch(array_values(array_unique([
            ...$this->publishing->tagsFor($page),
            ...($previousSlug ? ['page:'.$previousSlug] : []),
        ])));
    }
}
