<?php

namespace App\Http\Resources;

use App\Support\Markdown;
use App\Support\RequestLocale;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Page */
class PageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'status' => $this->status->value,
            'title' => $this->title,
            'body_html' => Markdown::toHtml($this->body_markdown),
            'body_markdown' => $this->when(
                (bool) $request->user()?->hasPermission('pages.view'),
                fn () => $this->body_markdown,
            ),
            'toc' => Markdown::headings($this->body_markdown),
            'template' => $this->template,
            /*
             * False when English was asked for and this is the Bengali document,
             * because no English one has been written. The page renders it with a
             * visible notice rather than pretending it is a translation.
             *
             * Read from the slug: the English documents are the ones suffixed
             * `-en`, so the row itself says which language it is.
             */
            'translated' => ! RequestLocale::isEnglish($request)
                || str_ends_with($this->slug, '-en'),
            // The frontend renders a visible DRAFT banner while this is true.
            'awaiting_legal_review' => $this->isAwaitingLegalReview(),
            'legal_reviewer' => $this->legal_reviewed ? $this->legal_reviewer : null,
            'legal_reviewed_at' => $this->legal_reviewed_at?->toIso8601String(),
            'published_at' => $this->published_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'seo' => new SeoResource($this->whenLoaded('seo')),
        ];
    }
}
