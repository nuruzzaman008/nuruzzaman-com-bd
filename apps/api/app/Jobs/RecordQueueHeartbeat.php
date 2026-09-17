<?php

namespace App\Jobs;

use App\Support\OperationalHealth;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Queued by the scheduler; running at all proves a worker is taking jobs. */
class RecordQueueHeartbeat implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function handle(): void
    {
        OperationalHealth::beat(OperationalHealth::QUEUE_KEY);
    }
}
