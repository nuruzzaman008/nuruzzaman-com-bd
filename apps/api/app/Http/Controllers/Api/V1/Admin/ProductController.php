<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ContentStatus;
use App\Enums\ProductType;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Jobs\RevalidateFrontend;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Content\PublishingService;
use App\Support\Audit;
use App\Support\ListFilters;
use App\Support\SearchTerm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function __construct(private readonly PublishingService $publishing) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Product::class);

        $validated = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'status' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', ContentStatus::values())],
            'type' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', ProductType::values())],
            'month' => ['sometimes', 'nullable', 'string', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            // The dashboard leaves course listings out: they are managed under Courses.
            'exclude_type' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', ProductType::values())],
        ]);

        // Without the status or the month: those two are what the filters count.
        $base = Product::query()
            ->when($validated['q'] ?? null, fn ($query, $term) => SearchTerm::titleOrSlug($query, $term, 'name'))
            ->when($validated['type'] ?? null, fn ($query, $type) => $query->where('type', $type))
            ->when($validated['exclude_type'] ?? null, fn ($query, $type) => $query->where('type', '!=', $type));

        $month = $validated['month'] ?? null;

        $products = ListFilters::month($base->clone(), $month)
            // seo is what the dashboard list scores each product on.
            ->with(['activeVariants.prices', 'cover', 'seo'])
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->orderBy('name')
            ->paginate(50)
            ->withQueryString();

        return ProductResource::collection($products)->additional([
            'filters' => [
                'counts' => ListFilters::statusCounts(ListFilters::month($base->clone(), $month)),
                'months' => ListFilters::months($base->clone()),
                'types' => $base->clone()->toBase()->reorder()->distinct()->pluck('type')->sort()->values()->all(),
            ],
        ]);
    }

    public function show(Product $product): ProductResource
    {
        $this->authorize('view', $product);

        return new ProductResource($product->load(['activeVariants.prices', 'variants.prices', 'cover', 'seo']));
    }

    public function store(Request $request): ProductResource
    {
        $this->authorize('create', Product::class);

        $validated = $request->validate($this->rules(null));
        $product = Product::create($validated + ['status' => ContentStatus::Draft]);

        Audit::record('product.created', $product, ['slug' => $product->slug]);

        return new ProductResource($product->load('activeVariants.prices'));
    }

    public function update(Request $request, Product $product): ProductResource
    {
        $this->authorize('update', $product);

        $validated = $request->validate($this->rules($product->getKey()));

        $product->update(collect($validated)->except('seo')->all());

        // `seo` is a related record, not a column, so it is written separately
        // and only when the caller actually sent it.
        //
        // Read from $validated rather than $request->validated(): that method
        // belongs to a FormRequest, and this controller takes a plain Request,
        // which has no such macro. Every save that carried an seo key - which
        // is every save the dashboard's SEO panel makes - answered 500.
        if (array_key_exists('seo', $validated)) {
            $product->seo()->updateOrCreate([], $validated['seo']);
        }

        Audit::record('product.updated', $product, ['fields' => array_keys($validated)]);

        return new ProductResource($product->fresh()->load(['activeVariants.prices', 'cover', 'seo']));
    }

    public function transition(Request $request, Product $product): ProductResource
    {
        $this->authorize('update', $product);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', ContentStatus::values())],
        ]);

        $this->publishing->transition($product, ContentStatus::from($validated['status']), $request->user());

        return new ProductResource($product->fresh()->load('activeVariants.prices'));
    }

    /**
     * Moves a product to the trash, unless it has been bought.
     *
     * An order line keeps the name, the SKU and the price it was sold at, so a
     * deleted product does not erase anyone's receipt - but a shop that quietly
     * loses the thing an order points at is a shop nobody can answer questions
     * about. One that has sold is refused here and unpublished instead, which
     * takes it out of the shop and leaves the history whole.
     */
    public function destroy(Product $product): JsonResponse
    {
        $this->authorize('delete', $product);

        $sold = OrderItem::query()
            ->whereIn('product_variant_id', $product->variants()->select('id'))
            ->count();

        if ($sold > 0) {
            throw DomainException::conflict(
                "This product has been ordered {$sold} time(s), so it cannot be deleted. Unpublish it instead and it leaves the shop."
            );
        }

        $slug = $product->slug;
        $product->delete();

        Audit::record('product.deleted', $product, ['slug' => $slug]);
        RevalidateFrontend::dispatch($this->publishing->tagsFor($product));

        return response()->json(['message' => 'Product moved to trash.']);
    }

    private function rules(?int $productId): array
    {
        return [
            'slug' => [
                $productId ? 'sometimes' : 'required',
                'string', 'max:180', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('products', 'slug')->ignore($productId),
            ],
            'type' => [$productId ? 'sometimes' : 'required', 'string', 'in:'.implode(',', ProductType::values())],
            'name' => [$productId ? 'sometimes' : 'required', 'string', 'max:200'],
            'tagline' => ['nullable', 'string', 'max:255'],
            'description_markdown' => ['nullable', 'string', 'max:200000'],
            'cover_media_id' => ['nullable', 'integer', 'exists:media,id'],
            'feature_groups' => ['sometimes', 'array'],
            'specs' => ['sometimes', 'array'],
            'is_price_public' => ['sometimes', 'boolean'],
            'seo' => ['sometimes', 'array'],
            'seo.meta_title' => ['nullable', 'string', 'max:255'],
            'seo.meta_description' => ['nullable', 'string', 'max:320'],
            'seo.focus_keyword' => ['nullable', 'string', 'max:160'],
            'seo.canonical_url' => ['nullable', 'url', 'max:512'],
            'seo.noindex' => ['sometimes', 'boolean'],
            'seo.nofollow' => ['sometimes', 'boolean'],
        ];
    }
}
