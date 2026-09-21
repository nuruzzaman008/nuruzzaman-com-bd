<?php

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
    Route::delete('me/mfa', [MfaController::class, 'destroy']);
});
