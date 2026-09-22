<?php

use App\Http\Controllers\Api\V1\Admin\NotificationEmailController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\NotificationPreferenceController;
use Illuminate\Support\Facades\Route;

/*
| The notification center.
|
| Registered from bootstrap/app.php, like routes/api_mfa.php, so it stands on
| its own while other work is in flight on the main route files.
|
| The same controller serves staff under /admin (where RequireStaffMfa
| demands a verified second step) and customers under /me; each side refuses
| the other (NotificationController::owner).
*/

$inbox = function () {
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::get('notifications/feed', [NotificationController::class, 'feed']);
    Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
    Route::delete('notifications/read', [NotificationController::class, 'clearRead']);
    Route::post('notifications/{notification}/read', [NotificationController::class, 'read']);
    Route::post('notifications/{notification}/unread', [NotificationController::class, 'unreadOne']);
    Route::delete('notifications/{notification}', [NotificationController::class, 'destroy']);
};

Route::middleware(['auth:sanctum', 'active', 'throttle:api'])->prefix('me')->group(function () use ($inbox) {
    $inbox();
    Route::get('notification-preferences', [NotificationPreferenceController::class, 'show']);
    Route::put('notification-preferences', [NotificationPreferenceController::class, 'update']);
});

Route::middleware([
    'auth:sanctum', 'active', 'verified', 'throttle:api',
    'role:super_admin,admin,editor,instructor,support',
])->prefix('admin')->group($inbox);

// The email log names recipients and failure reasons: administrators only.
Route::middleware(['auth:sanctum', 'active', 'verified', 'throttle:api', 'role:super_admin,admin'])
    ->prefix('admin')
    ->group(function () {
        Route::get('notification-emails', [NotificationEmailController::class, 'index']);
        Route::post('notification-emails/retry-failed', [NotificationEmailController::class, 'retryFailed']);
        Route::post('notification-emails/{email}/retry', [NotificationEmailController::class, 'retry']);
        Route::post('notification-emails/jobs/{uuid}/retry', [NotificationEmailController::class, 'retryJob']);
        Route::post('notifications/prune', [NotificationEmailController::class, 'prune']);
    });
