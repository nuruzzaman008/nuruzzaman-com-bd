<?php

use App\Jobs\ReconcilePayments;
use App\Jobs\RecordQueueHeartbeat;
use App\Services\Notifications\NotificationMaintenance;
use App\Support\OperationalHealth;
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

// Heartbeats read by /up (App\Support\OperationalHealth): the scheduler notes
// that it ran, and queues a job whose running proves a worker is taking jobs.
Schedule::call(fn () => OperationalHealth::beat(OperationalHealth::SCHEDULER_KEY))
    ->name('health:scheduler-heartbeat')
    ->everyFiveMinutes();

Schedule::job(new RecordQueueHeartbeat)->everyFiveMinutes();

// Notification center (App\Services\Notifications\NotificationMaintenance).
Artisan::command('notifications:retry-emails', function (NotificationMaintenance $maintenance) {
    $this->info($maintenance->retryDue().' notification email(s) queued again.');
})->purpose('Queue failed notification emails for another attempt');

Artisan::command('notifications:prune', function (NotificationMaintenance $maintenance) {
    $removed = $maintenance->prune();
    $this->info("Removed {$removed['notifications']} old read notification(s) and {$removed['emails']} old sent email record(s).");
})->purpose('Remove read notifications after 90 days and sent email records after 180');

// Failed notification emails get another go every ten minutes, up to five
// attempts; the email log can resend any of them by hand after that.
Schedule::call(fn () => Artisan::call('notifications:retry-emails'))
    ->name('notifications:retry-emails')
    ->everyTenMinutes()
    ->withoutOverlapping();

Schedule::call(fn () => Artisan::call('notifications:prune'))
    ->name('notifications:prune')
    ->dailyAt('02:40');
