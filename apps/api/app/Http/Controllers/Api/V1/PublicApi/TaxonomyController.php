<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuthorResource;
use App\Http\Resources\CategoryResource;
use App\Models\Author;
use App\Models\Category;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TaxonomyController extends Controller
{
    public function categories(): AnonymousResourceCollection
    {
        $categories = Category::query()
            ->withCount(['posts' => fn ($query) => $query->published()])
            ->orderBy('position')
            ->orderBy('name')
            ->get();

        return CategoryResource::collection($categories);
    }

    public function category(string $slug): CategoryResource
    {
        $category = Category::query()
            ->where('slug', $slug)
            ->withCount(['posts' => fn ($query) => $query->published()])
            ->firstOrFail();

        return new CategoryResource($category);
    }

    public function authors(): AnonymousResourceCollection
    {
        return AuthorResource::collection(Author::query()->with('photo')->orderBy('name')->get());
    }

    public function author(string $slug): AuthorResource
    {
        return new AuthorResource(
            Author::query()->with('photo')->where('slug', $slug)->firstOrFail()
        );
    }
}
