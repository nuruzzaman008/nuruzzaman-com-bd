<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Http\Controllers\Controller;
use App\Http\Resources\PageResource;
use App\Models\Page;
use App\Support\RequestLocale;
use Illuminate\Http\Request;

class PageController extends Controller
{
    /**
     * A CMS page, in the language the caller asked for.
     *
     * An English page is a separate document under the same slug plus `-en`,
     * edited in the admin like any other. Resolving that here rather than in the
     * front end means one request instead of two - the front end used to ask for
     * the English document, take the 404, and ask again - and it keeps the
     * fallback rule in one place.
     *
     * When no English document exists the Bengali one is returned with
     * `translated: false`, so the page can say so rather than quietly render a
     * language the reader did not choose.
     */
    public function show(Request $request, string $slug): PageResource
    {
        $page = null;

        if (RequestLocale::isEnglish($request)) {
            $page = $this->find($slug.'-en');
        }

        $page ??= $this->find($slug);

        abort_if($page === null, 404);

        return new PageResource($page);
    }

    private function find(string $slug): ?Page
    {
        return Page::query()
            ->published()
            ->where('slug', $slug)
            ->with('seo.ogImage')
            ->first();
    }
}
