<?php

use App\Jobs\ReconcilePayments;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Publishes anything whose scheduled time has arrived and refreshes the
// affected Next.js cache tags.
Schedule::command('content:publish-due')->everyFiveMinutes()->withoutOverlapping();

// Safety net for lost or delayed payment callbacks.
Schedule::job(new ReconcilePayments)->everyFifteenMinutes()->withoutOverlapping();

// Housekeeping: expired enrolments, stale carts, used idempotency keys.
Schedule::command('platform:housekeeping')->dailyAt('02:15');
