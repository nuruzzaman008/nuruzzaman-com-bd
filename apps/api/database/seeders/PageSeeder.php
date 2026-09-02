<?php

namespace Database\Seeders;

use App\Enums\ContentStatus;
use App\Models\Page;
use Database\Seeders\Support\ContentBundle;
use Illuminate\Database\Seeder;

class PageSeeder extends Seeder
{
    public function run(): void
    {
        foreach (ContentBundle::load('seed-pages-bn.md') as $document) {
            $meta = $document['meta'];
            $requiresLegalReview = ContentBundle::bool($meta, 'requires_legal_review');

            $page = Page::query()->updateOrCreate(
                ['slug' => $meta['slug']],
                [
                    'title' => $meta['title'],
                    'body_markdown' => $document['body'],
                    'template' => $meta['template'] ?? 'default',
                    'status' => ContentStatus::Published,
                    'requires_legal_review' => $requiresLegalReview,
                    // Reviewed only when the owner has recorded a real review.
                    'legal_reviewed' => $requiresLegalReview
                        ? (bool) config('nb.legal.reviewed')
                        : true,
                    'legal_reviewer' => $requiresLegalReview ? config('nb.legal.reviewer') : null,
                    'published_at' => now(),
                ],
            );

            $page->seo()->updateOrCreate([], [
                'meta_title' => $meta['meta_title'] ?? $meta['title'],
                'meta_description' => $meta['meta_description'] ?? null,
                'noindex' => ContentBundle::bool($meta, 'noindex'),
            ]);
        }
    }
}
