<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ContentStatus;
use App\Enums\ProductType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Content\PublishingService;
use App\Support\Audit;
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

        $products = Product::query()
            ->with(['activeVariants.prices', 'cover'])
            ->orderBy('name')
            ->paginate(50);

        return ProductResource::collection($products);
    }

    public function show(Product $product): ProductResource
    {
        $this->authorize('view', $product);

        return new ProductResource($product->load(['activeVariants.prices', 'cover', 'seo']));
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

        $product->update(collect($request->validate($this->rules($product->getKey())))
            ->except('seo')
            ->all());

        // `seo` is a related record, not a column, so it is written separately
        // and only when the caller actually sent it.
        if ($request->has('seo')) {
            $product->seo()->updateOrCreate([], $request->validated('seo'));
        }

        return new ProductResource($product->fresh()->load('activeVariants.prices'));
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
