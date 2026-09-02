<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Http\Resources\ProductSummaryResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'type' => ['sometimes', 'string', 'in:software_license,credit_refill,course,bundle,digital_resource'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $products = Product::query()
            ->published()
            ->with(['cover', 'activeVariants.prices', 'activeVariants.course'])
            ->when($validated['type'] ?? null, fn ($query, $type) => $query->where('type', $type))
            ->orderBy('name')
            ->paginate($validated['per_page'] ?? 24)
            ->withQueryString();

        return ProductSummaryResource::collection($products);
    }

    public function show(string $slug): ProductResource
    {
        $product = Product::query()
            ->published()
            ->where('slug', $slug)
            ->with(['cover', 'seo.ogImage', 'activeVariants.prices', 'activeVariants.course'])
            ->firstOrFail();

        return new ProductResource($product);
    }
}
