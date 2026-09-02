<?php

namespace App\Console\Commands;

use App\Services\Content\PublishingService;
use Illuminate\Console\Command;

class PublishDueContent extends Command
{
    protected $signature = 'content:publish-due';

    protected $description = 'Publish scheduled posts whose publication time has arrived.';

    public function handle(PublishingService $publishing): int
    {
        $count = $publishing->publishDue();

        $this->info($count === 0 ? 'Nothing was due.' : "Published {$count} item(s).");

        return self::SUCCESS;
    }
}
