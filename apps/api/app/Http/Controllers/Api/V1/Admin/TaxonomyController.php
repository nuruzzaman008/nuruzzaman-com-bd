<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Tag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TaxonomyController extends Controller
{
    public function categories(Request $request): JsonResponse
    {
        $this->guard($request);

        return response()->json(['data' => Category::query()->orderBy('position')->orderBy('name')->get()]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate([
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:categories,slug'],
            'name' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:2000'],
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'position' => ['sometimes', 'integer', 'min:0', 'max:9999'],
        ]);

        return response()->json(['data' => Category::create($validated)], 201);
    }

    public function updateCategory(Request $request, Category $category): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate([
            'slug' => ['sometimes', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('categories', 'slug')->ignore($category->getKey())],
            'name' => ['sometimes', 'string', 'max:160'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'parent_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
            'position' => ['sometimes', 'integer', 'min:0', 'max:9999'],
        ]);

        $category->update($validated);

        return response()->json(['data' => $category->fresh()]);
    }

    public function destroyCategory(Request $request, Category $category): JsonResponse
    {
        $this->guard($request);
        $category->delete();

        return response()->json(['message' => 'Category deleted.']);
    }

    public function tags(Request $request): JsonResponse
    {
        $this->guard($request);

        return response()->json(['data' => Tag::query()->orderBy('name')->get()]);
    }

    public function storeTag(Request $request): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate([
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:tags,slug'],
            'name' => ['required', 'string', 'max:160'],
        ]);

        return response()->json(['data' => Tag::create($validated)], 201);
    }

    public function destroyTag(Request $request, Tag $tag): JsonResponse
    {
        $this->guard($request);
        $tag->delete();

        return response()->json(['message' => 'Tag deleted.']);
    }

    private function guard(Request $request): void
    {
        abort_unless($request->user()->hasPermission('posts.update'), 403);
    }
}
