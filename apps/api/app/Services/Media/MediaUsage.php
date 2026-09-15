<?php

namespace App\Services\Media;

use App\Models\Media;
use App\Support\SearchTerm;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Where a media file is still shown: picked by id as a cover or photo, or
 * written by its address into an article, page, description or lesson.
 *
 * Deleting a file in use empties a cover and breaks an image inside the text,
 * so the library names those places and asks before doing either.
 */
class MediaUsage
{
    /** [table, label, title column, column holding the picked media id] */
    private const PICKED = [
        ['posts', 'Article', 'title', 'cover_media_id'],
        ['products', 'Product', 'name', 'cover_media_id'],
        ['courses', 'Course', 'title', 'cover_media_id'],
        ['course_bundles', 'Course bundle', 'title', 'cover_media_id'],
        ['authors', 'Author', 'name', 'photo_media_id'],
    ];

    /** [table, label, title column, text columns the file's address can be written into] */
    private const WRITTEN = [
        ['posts', 'Article', 'title', ['body_markdown']],
        ['pages', 'Page', 'title', ['body_markdown']],
        ['products', 'Product', 'name', ['description_markdown', 'description_markdown_en']],
        ['courses', 'Course', 'title', ['description_markdown']],
        ['course_bundles', 'Course bundle', 'title', ['description_markdown']],
        ['lessons', 'Lesson', 'title', ['body_markdown']],
    ];

    /** Enough to recognise the problem; the admin does not need every row. */
    private const LIMIT = 10;

    /** @return list<string> such as 'Product “NB Engineering Tools”' */
    public function placesFor(Media $media): array
    {
        $places = [];

        foreach (self::PICKED as [$table, $label, $title, $column]) {
            if (! Schema::hasColumn($table, $column)) {
                continue;
            }

            foreach (DB::table($table)->where($column, $media->getKey())->limit(self::LIMIT)->pluck($title) as $name) {
                $places[] = "{$label} “{$name}”";
            }
        }

        if (Schema::hasColumn('seo_meta', 'og_media_id')) {
            $shared = DB::table('seo_meta')->where('og_media_id', $media->getKey())->count();

            if ($shared > 0) {
                $places[] = "Social share image ({$shared})";
            }
        }

        $pattern = SearchTerm::contains($media->path);

        foreach (self::WRITTEN as [$table, $label, $title, $columns]) {
            $columns = array_values(array_filter($columns, fn (string $column) => Schema::hasColumn($table, $column)));

            if ($columns === []) {
                continue;
            }

            $names = DB::table($table)
                ->where(function ($query) use ($columns, $pattern) {
                    foreach ($columns as $column) {
                        $query->orWhere($column, 'like', $pattern);
                    }
                })
                ->limit(self::LIMIT)
                ->pluck($title);

            foreach ($names as $name) {
                $places[] = "{$label} “{$name}”";
            }
        }

        return array_values(array_unique($places));
    }
}
