<?php

use App\Http\Controllers\Api\V1\Admin\GrowthGmailController;
use App\Http\Middleware\EndSessionsOnPasswordChange;
use App\Http\Middleware\RequireStaffMfa;
use Illuminate\Support\Facades\Route;

// OAuth returns as a browser navigation without Sanctum's first-party headers.
// The web session and the existing admin/MFA checks must both run here.
Route::get('/api/v1/admin/growth-hub/gmail/callback', [GrowthGmailController::class, 'callback'])
    ->middleware(['auth:sanctum', 'active', 'verified', 'role:super_admin', EndSessionsOnPasswordChange::class, RequireStaffMfa::class, 'throttle:20,1,growth-gmail-callback:']);

Route::get('/', function () {
    return view('welcome');
});
