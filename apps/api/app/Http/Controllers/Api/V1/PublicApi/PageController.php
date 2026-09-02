<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Http\Resources\PageResource;
use App\Models\Page;

class PageController extends Controller
{
    public function show(string $slug): PageResource
    {
        $page = Page::query()
            ->published()
            ->where('slug', $slug)
            ->with('seo.ogImage')
            ->firstOrFail();

        return new PageResource($page);
    }
}
