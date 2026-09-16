<?php

namespace App\Support;

use App\Enums\ContentStatus;
use Illuminate\Database\Eloquent\Builder;

/**
 * The filters above an admin list: how many rows are in each status, which
 * months have anything in them, and the month filter itself.
 *
 * Content is filed under the month it went live, or the month it was made when
 * it never has - so a draft written in September is found under September
 * rather than nowhere at all. An order is filed under the month it was placed;
 * callers with another date say which with `$filed`.
 */
final class ListFilters
{
    /**
     * The date a row is filed under. Written into SQL as it stands, so a caller
     * passes a column expression of its own, never anything from a request.
     */
    private const FILED = "COALESCE(published_at, created_at)";

    public static function month(Builder $query, ?string $month, string $filed = self::FILED): Builder
    {
        if (! $month) {
            return $query;
        }

        return $query->whereRaw('DATE_FORMAT('.$filed.", '%Y-%m') = ?", [$month]);
    }

    /**
     * Months that have rows, newest first, as `YYYY-MM`.
     *
     * @return list<string>
     */
    public static function months(Builder $query, string $filed = self::FILED): array
    {
        return $query->clone()
            ->toBase()
            ->reorder()
            ->selectRaw('DATE_FORMAT('.$filed.", '%Y-%m') as ym")
            ->distinct()
            ->pluck('ym')
            ->filter()
            ->sortDesc()
            ->values()
            ->all();
    }

    /**
     * How many rows each status holds, plus `all`.
     *
     * Counted on the list as it is filtered, minus the status itself: the point
     * of the number beside "Draft" is to say how many drafts the current search
     * would show.
     *
     * @return array<string, int>
     */
    public static function statusCounts(Builder $query, ?array $statuses = null): array
    {
        $rows = $query->clone()
            ->toBase()
            ->reorder()
            ->select('status')
            ->selectRaw('count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $counts = ['all' => (int) $rows->sum()];

        foreach ($statuses ?? ContentStatus::values() as $status) {
            $counts[$status] = (int) ($rows[$status] ?? 0);
        }

        return $counts;
    }
}
