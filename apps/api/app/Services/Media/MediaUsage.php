<?php

namespace App\Services\Media;

use App\Models\Course;
use App\Models\Media;
use App\Models\Page;
use App\Models\Post;
use App\Models\Product;
use App\Support\SearchTerm;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Where a media file is still shown: picked by id as a cover or photo, or
 * written by its address into an article, page, description or lesson.
 *
 * Deleting a file in use empties a cover and breaks an image inside the text,
 * so the library names those places and asks before doing either. The same
 * places are the attachment's "Uploaded to", and their focus keywords are what
 * the library offers as its alt text.
 */
class MediaUsage
{
    /** [type, table, label, title column, column holding the picked media id] */
    private const PICKED = [
        ['post', 'posts', 'Article', 'title', 'cover_media_id'],
        ['product', 'products', 'Product', 'name', 'cover_media_id'],
        ['course', 'courses', 'Course', 'title', 'cover_media_id'],
        ['bundle', 'course_bundles', 'Course bundle', 'title', 'cover_media_id'],
        ['author', 'authors', 'Author', 'name', 'photo_media_id'],
    ];

    /** [type, table, label, title column, text columns the file's address can be written into] */
    private const WRITTEN = [
        ['post', 'posts', 'Article', 'title', ['body_markdown']],
        ['page', 'pages', 'Page', 'title', ['body_markdown']],
        ['product', 'products', 'Product', 'name', ['description_markdown', 'description_markdown_en']],
        ['course', 'courses', 'Course', 'title', ['description_markdown']],
        ['bundle', 'course_bundles', 'Course bundle', 'title', ['description_markdown']],
        ['lesson', 'lessons', 'Lesson', 'title', ['body_markdown']],
    ];

    /** The content types that carry a focus keyword. */
    private const SEOABLE = [
        'post' => Post::class,
        'product' => Product::class,
        'course' => Course::class,
        'page' => Page::class,
    ];

    /** Enough to recognise the problem; the admin does not need every row. */
    private const LIMIT = 10;

    /**
     * Each piece of content using the file, once, however it uses it.
     *
     * @return list<array{type: string, id: int, label: string, title: string, edit_path: ?string}>
     */
    public function usesOf(Media $media): array
    {
        $uses = [];

        foreach (self::PICKED as [$type, $table, $label, $title, $column]) {
            if (! Schema::hasColumn($table, $column)) {
                continue;
            }

            $rows = DB::table($table)
                ->where($column, $media->getKey())
                ->limit(self::LIMIT)
                ->get($this->columns($type, $title));

            foreach ($rows as $row) {
                $uses[$type.':'.$row->id] ??= $this->use($type, $label, $row);
            }
        }

        $pattern = SearchTerm::contains($media->path);

        foreach (self::WRITTEN as [$type, $table, $label, $title, $columns]) {
            $columns = array_values(array_filter($columns, fn (string $column) => Schema::hasColumn($table, $column)));

            if ($columns === []) {
                continue;
            }

            $rows = DB::table($table)
                ->where(function ($query) use ($columns, $pattern) {
                    foreach ($columns as $column) {
                        $query->orWhere($column, 'like', $pattern);
                    }
                })
                ->limit(self::LIMIT)
                ->get($this->columns($type, $title));

            foreach ($rows as $row) {
                $uses[$type.':'.$row->id] ??= $this->use($type, $label, $row);
            }
        }

        return array_values($uses);
    }

    /** How many pages share the file as their social image. */
    public function sharedAsSocialImage(Media $media): int
    {
        return Schema::hasColumn('seo_meta', 'og_media_id')
            ? DB::table('seo_meta')->where('og_media_id', $media->getKey())->count()
            : 0;
    }

    /** @return list<string> such as 'Product “NB Engineering Tools”' */
    public function placesFor(Media $media): array
    {
        $places = array_map(fn (array $use) => "{$use['label']} “{$use['title']}”", $this->usesOf($media));
        $shared = $this->sharedAsSocialImage($media);

        if ($shared > 0) {
            $places[] = "Social share image ({$shared})";
        }

        return $places;
    }

    /**
     * The focus keywords of the content using the file - the words an image
     * there should be described with.
     *
     * @param  list<array{type: string, id: int, label: string, title: string}>  $uses
     * @return list<array{keyword: string, source: string}>
     */
    public function focusKeywordsFor(array $uses): array
    {
        if (! Schema::hasColumn('seo_meta', 'focus_keyword')) {
            return [];
        }

        $keywords = [];

        foreach (self::SEOABLE as $type => $model) {
            $matching = array_values(array_filter($uses, fn (array $use) => $use['type'] === $type));

            if ($matching === []) {
                continue;
            }

            $found = DB::table('seo_meta')
                ->where('seoable_type', (new $model)->getMorphClass())
                ->whereIn('seoable_id', array_column($matching, 'id'))
                ->whereNotNull('focus_keyword')
                ->pluck('focus_keyword', 'seoable_id');

            foreach ($matching as $use) {
                $keyword = trim((string) ($found[$use['id']] ?? ''));
                $key = mb_strtolower($keyword);

                if ($keyword !== '' && ! isset($keywords[$key])) {
                    $keywords[$key] = ['keyword' => $keyword, 'source' => "{$use['label']} “{$use['title']}”"];
                }
            }
        }

        return array_values($keywords);
    }

    /** @return list<string> */
    private function columns(string $type, string $title): array
    {
        return array_merge(['id', $title.' as title'], $type === 'lesson' ? ['course_id'] : []);
    }

    /** @return array{type: string, id: int, label: string, title: string, edit_path: ?string} */
    private function use(string $type, string $label, object $row): array
    {
        return [
            'type' => $type,
            'id' => (int) $row->id,
            'label' => $label,
            'title' => (string) $row->title,
            'edit_path' => match ($type) {
                'post' => '/dashboard/posts/'.$row->id,
                'product' => '/dashboard/products/'.$row->id,
                'course' => '/dashboard/courses/'.$row->id,
                // A lesson is edited inside its course.
                'lesson' => '/dashboard/courses/'.$row->course_id,
                'page' => '/dashboard/pages',
                default => null,
            },
        ];
    }
}
