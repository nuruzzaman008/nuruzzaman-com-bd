<?php

namespace App\Listeners;

use App\Support\OperationalHealth;
use Illuminate\Foundation\Events\DiagnosingHealth;
use RuntimeException;

/** Makes Laravel's /up answer 500 when the application is up but not working. */
class CheckOperationalHealth
{
    public function handle(DiagnosingHealth $event): void
    {
        $problems = OperationalHealth::problems();

        if ($problems !== []) {
            throw new RuntimeException('Health check failed: '.implode('; ', $problems).'.');
        }
    }
}
