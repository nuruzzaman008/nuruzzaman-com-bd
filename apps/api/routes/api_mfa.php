<?php

use App\Http\Controllers\Api\V1\Admin\TwoFactorResetController;
use App\Http\Controllers\Api\V1\Auth\LoginController;
use App\Http\Controllers\Api\V1\Auth\MfaController;
use Illuminate\Support\Facades\Route;

/*
| Two-step verification.
|
| Registered from bootstrap/app.php rather than from routes/api.php, so this
| file stands on its own while other work is in flight on the main route files.
| The setup endpoints need a session; the challenge deliberately does not,
| because the visitor is halfway through signing in.
*/

Route::post('auth/mfa', [LoginController::class, 'challenge'])->middleware('throttle:auth');

// Keyed per account rather than per address: setting an app up is not a
// guess at someone else's password.
Route::middleware(['auth:sanctum', 'active', 'throttle:verify-email'])->group(function () {
    Route::post('me/mfa', [MfaController::class, 'start']);
    Route::post('me/mfa/confirm', [MfaController::class, 'confirm']);
    Route::post('me/mfa/verify', [MfaController::class, 'verify']);
    Route::post('me/mfa/recovery-codes', [MfaController::class, 'recoveryCodes']);
    Route::delete('me/mfa', [MfaController::class, 'destroy']);
});

/*
| A super admin or admin clearing another staff member's second step. Under
| /admin, so RequireStaffMfa demands their own session has typed a code; the
| rules for who may reset whom are UserPolicy::resetTwoFactor.
*/
Route::middleware(['auth:sanctum', 'active', 'verified', 'role:super_admin,admin', 'throttle:10,1'])
    ->prefix('admin')
    ->group(function () {
        Route::post('users/{user:id}/mfa/reset', [TwoFactorResetController::class, 'store']);
    });
