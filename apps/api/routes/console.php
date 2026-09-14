<?php

use App\Jobs\ReconcilePayments;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
| Everything scheduled runs inside the scheduler's own PHP process.
|
| Schedule::command() starts each command as a child process through
| proc_open, which the host has disabled: every run failed with "The Process
| class relies on proc_open", so scheduled posts were never published and
| housekeeping never ran. Artisan::call() runs the same command in-process.
| A named callback is what withoutOverlapping() needs to take its lock.
*/

// Publishes anything whose scheduled time has arrived and refreshes the
// affected Next.js cache tags.
Schedule::call(fn () => Artisan::call('content:publish-due'))
    ->name('content:publish-due')
    ->everyFiveMinutes()
    ->withoutOverlapping();

// Safety net for lost or delayed payment callbacks. A job is dispatched
// in-process already.
Schedule::job(new ReconcilePayments)->everyFifteenMinutes()->withoutOverlapping();

// Housekeeping: expired enrolments, stale carts, used idempotency keys.
Schedule::call(fn () => Artisan::call('platform:housekeeping'))
    ->name('platform:housekeeping')
    ->dailyAt('02:15');
