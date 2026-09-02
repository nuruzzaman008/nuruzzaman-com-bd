<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductVariantController extends Controller
{
    public function store(Request $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);

        $validated = $request->validate([
            'sku' => ['required', 'string', 'max:64', 'unique:product_variants,sku'],
            'name' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:512'],
            'credit_amount' => ['nullable', 'integer', 'min:1'],
            'license_term_days' => ['nullable', 'integer', 'min:1'],
            'device_limit' => ['nullable', 'integer', 'min:1', 'max:255'],
            'access_duration_days' => ['nullable', 'integer', 'min:1'],
            'course_id' => ['nullable', 'integer', 'exists:courses,id'],
            'is_active' => ['sometimes', 'boolean'],
            'position' => ['sometimes', 'integer', 'min:0'],
        ]);

        return response()->json(['data' => $product->variants()->create($validated)], 201);
    }

    public function update(Request $request, Product $product, ProductVariant $variant): JsonResponse
    {
        $this->authorize('update', $product);
        abort_unless($variant->product_id === $product->getKey(), 404);

        $validated = $request->validate([
            'sku' => ['sometimes', 'string', 'max:64', Rule::unique('product_variants', 'sku')->ignore($variant->getKey())],
            'name' => ['sometimes', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string', 'max:512'],
            'credit_amount' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'license_term_days' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'device_limit' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:255'],
            'access_duration_days' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'course_id' => ['sometimes', 'nullable', 'integer', 'exists:courses,id'],
            'is_active' => ['sometimes', 'boolean'],
            'position' => ['sometimes', 'integer', 'min:0'],
        ]);

        $variant->update($validated);

        return response()->json(['data' => $variant->fresh()]);
    }

    /**
     * Prices are append-only: publishing a new one deactivates the previous
     * row, so an order snapshot always points at a price that really existed.
     */
    public function storePrice(Request $request, Product $product, ProductVariant $variant): JsonResponse
    {
        $this->authorize('update', $product);
        abort_unless($variant->product_id === $product->getKey(), 404);

        $validated = $request->validate([
            'currency' => ['sometimes', 'string', 'size:3'],
            'amount_minor' => ['required', 'integer', 'min:1'],
            'compare_at_minor' => ['nullable', 'integer', 'min:1', 'gt:amount_minor'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);

        $variant->prices()->update(['is_active' => false]);
        $price = $variant->prices()->create($validated + ['is_active' => true]);

        Audit::record('product.price_published', $variant, [
            'sku' => $variant->sku,
            'amount_minor' => $price->amount_minor,
        ]);

        return response()->json(['data' => $price], 201);
    }

    /** Links protected download assets to what a variant entitles. */
    public function syncDownloads(Request $request, Product $product, ProductVariant $variant): JsonResponse
    {
        $this->authorize('update', $product);
        abort_unless($variant->product_id === $product->getKey(), 404);

        $validated = $request->validate([
            'assets' => ['present', 'array'],
            'assets.*.download_asset_id' => ['required', 'integer', 'exists:download_assets,id'],
            'assets.*.max_downloads' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'assets.*.valid_days' => ['nullable', 'integer', 'min:1', 'max:36500'],
        ]);

        $variant->downloadAssets()->sync(collect($validated['assets'])->mapWithKeys(fn (array $row) => [
            $row['download_asset_id'] => [
                'max_downloads' => $row['max_downloads'] ?? null,
                'valid_days' => $row['valid_days'] ?? null,
            ],
        ])->all());

        return response()->json(['data' => $variant->fresh()->load('downloadAssets')]);
    }
}
