<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/** The admin lists' search box: part of a title, or part of a URL slug. */
final class SearchTerm
{
    /** A LIKE pattern for the term anywhere, with its own % and _ taken literally. */
    public static function contains(string $term): string
    {
        return '%'.addcslashes(trim($term), '\\%_').'%';
    }

    /**
     * Narrows the query to rows whose title or slug holds the term. The slug is
     * also tried in slug form, so "Basic English Sound" or "/basic-english-sound"
     * both find basic-english-sound.
     */
    public static function titleOrSlug(Builder $query, string $term, string $titleColumn): void
    {
        $term = trim($term);
        $slug = Str::slug($term);

        $query->where(function (Builder $query) use ($term, $slug, $titleColumn) {
            $query->where($titleColumn, 'like', self::contains($term))
                ->orWhere('slug', 'like', self::contains($term));

            // A title in Bengali has no slug form; an empty one would match everything.
            if ($slug !== '' && $slug !== $term) {
                $query->orWhere('slug', 'like', self::contains($slug));
            }
        });
    }
}
