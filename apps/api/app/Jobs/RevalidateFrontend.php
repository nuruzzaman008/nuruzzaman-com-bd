<?php

namespace App\Jobs;

use App\Services\Content\RevalidationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RevalidateFrontend implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [15, 60];

    /** @param array<int, string> $tags */
    public function __construct(public readonly array $tags) {}

    public function handle(RevalidationService $revalidation): void
    {
        $revalidation->revalidate($this->tags);
    }
}
