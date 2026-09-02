<?php

namespace Database\Seeders;

use App\Enums\ContentStatus;
use App\Models\Author;
use App\Models\Category;
use App\Models\Post;
use App\Support\Markdown;
use Database\Seeders\Support\ContentBundle;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds the topic clusters and the launch articles.
 *
 * `reviewed_by` records that a named engineer has actually checked the
 * calculation. Without it the article still publishes, but it carries a visible
 * notice saying the technical review is outstanding, and its structured data
 * omits any reviewer — the site never claims a review that did not happen.
 */
class BlogSeeder extends Seeder
{
    private const CLUSTERS = [
        'structural-engineering' => 'স্ট্রাকচারাল ইঞ্জিনিয়ারিং',
        'rcc-design-detailing' => 'RCC ডিজাইন ও ডিটেইলিং',
        'foundation-geotechnical' => 'ফাউন্ডেশন ও জিওটেকনিক্যাল',
        'autocad-productivity' => 'AutoCAD প্রোডাক্টিভিটি ও অটোমেশন',
        'engineering-software' => 'ইঞ্জিনিয়ারিং সফটওয়্যার টিউটোরিয়াল',
        'bnbc-code-application' => 'BNBC ও কোড প্রয়োগ',
        'construction-quality' => 'নির্মাণ মান ও ফিল্ড প্র্যাকটিস',
        'mouza-drawing-workflow' => 'মৌজা ম্যাপ ও ড্রয়িং ওয়ার্কফ্লো',
        'quantity-estimation' => 'কোয়ান্টিটি ও এস্টিমেট',
        'steel-design' => 'স্টিল স্ট্রাকচার ডিজাইন',
    ];

    public function run(): void
    {
        $position = 0;

        foreach (self::CLUSTERS as $slug => $name) {
            Category::query()->updateOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'position' => $position++],
            );
        }

        $author = Author::query()->where('slug', 'nuruzzaman')->first();

        // The launch set plus the wider library. Split across two files only
        // so each stays readable to edit by hand.
        $documents = [
            ...ContentBundle::load('seed-posts-bn.md'),
            ...ContentBundle::load('seed-posts-bn-library.md'),
        ];

        foreach ($documents as $document) {
            $meta = $document['meta'];
            $reviewed = ! blank($meta['reviewed_by'] ?? null);

            $post = Post::query()->updateOrCreate(
                ['slug' => $meta['slug']],
                [
                    'title' => $meta['title'],
                    'excerpt' => $meta['excerpt'] ?? Markdown::excerpt($document['body']),
                    'body_markdown' => $document['body'],
                    'author_id' => $author?->getKey(),
                    'reviewed_by_author_id' => $reviewed ? $author?->getKey() : null,
                    'reviewed_at' => $reviewed ? now() : null,
                    'reading_minutes' => Markdown::readingMinutes($document['body']),
                    'funnel_stage' => $meta['funnel_stage'] ?? null,
                    'search_intent' => $meta['search_intent'] ?? null,
                    // Publishing does not depend on review, but claiming a
                    // review does: an article without `reviewed_by` goes live
                    // carrying a visible "not yet engineer-reviewed" notice and
                    // omits reviewedBy from its structured data. Set
                    // `publish: false` in the front matter to hold one back.
                    'status' => ($meta['publish'] ?? 'true') === 'false'
                        ? ContentStatus::Draft
                        : ContentStatus::Published,
                    'published_at' => ($meta['publish'] ?? 'true') === 'false'
                        ? null
                        : now()->subDays((int) ($meta['days_ago'] ?? 0)),
                    'content_updated_at' => now(),
                ],
            );

            $categorySlugs = ContentBundle::list($meta, 'categories');
            $post->categories()->sync(Category::query()->whereIn('slug', $categorySlugs)->pluck('id'));

            $post->seo()->updateOrCreate([], [
                'meta_title' => $meta['meta_title'] ?? $meta['title'],
                'meta_description' => $meta['meta_description'] ?? Str::limit($post->excerpt, 155),
            ]);
        }
    }
}
