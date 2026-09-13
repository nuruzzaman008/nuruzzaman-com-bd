<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Support\Markdown;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The editor's preview.
 *
 * Rendered by the same code the public pages use, rather than by a second
 * renderer in the browser, so what an author sees is what readers get - which
 * formatting is kept, which raw HTML is stripped, and how a heading, a colour
 * or a code block actually comes out.
 */
class MarkdownPreviewController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user?->hasPermission('posts.update')
            || $user?->hasPermission('products.manage')
            || $user?->hasPermission('courses.manage'),
            403,
        );

        $validated = $request->validate([
            'markdown' => ['nullable', 'string', 'max:200000'],
        ]);

        return response()->json([
            'data' => ['html' => Markdown::toHtml($validated['markdown'] ?? null)],
        ]);
    }
}
