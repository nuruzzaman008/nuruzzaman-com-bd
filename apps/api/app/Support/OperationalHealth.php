<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * What /up checks beyond "PHP answered".
 *
 * The scheduler and the queue worker are started by cron every minute. When
 * either stopped - the host disabled proc_open once, and every scheduled task
 * failed silently for days - the site kept answering, so nothing noticed. Each
 * now leaves a heartbeat in the cache every five minutes, and a heartbeat older
 * than fifteen minutes makes /up answer 500, which the uptime workflow reports.
 *
 * A heartbeat that is missing altogether counts as healthy: that is the state
 * right after the cache is cleared, before the first run has written one.
 */
class OperationalHealth
{
    public const SCHEDULER_KEY = 'health:heartbeat:scheduler';

    public const QUEUE_KEY = 'health:heartbeat:queue';

    public const STALE_AFTER_SECONDS = 15 * 60;

    public static function beat(string $key): void
    {
        Cache::put($key, now()->getTimestamp(), now()->addDay());
    }

    /**
     * Short, generic descriptions of what is wrong; empty when all is well. The
     * text reaches a public page and the log, so it never carries details.
     *
     * @return array<int, string>
     */
    public static function problems(): array
    {
        $problems = [];

        try {
            DB::select('select 1');
        } catch (Throwable) {
            $problems[] = 'database unavailable';
        }

        try {
            $heartbeats = [
                'scheduler' => Cache::get(self::SCHEDULER_KEY),
                'queue' => Cache::get(self::QUEUE_KEY),
            ];
        } catch (Throwable) {
            return [...$problems, 'cache unavailable'];
        }

        foreach ($heartbeats as $name => $timestamp) {
            if ($timestamp !== null && now()->getTimestamp() - (int) $timestamp > self::STALE_AFTER_SECONDS) {
                $problems[] = "{$name} has not run for more than 15 minutes";
            }
        }

        return $problems;
    }
}
