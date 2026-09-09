<?php

use App\Http\Controllers\Api\V1\OnlineLicenseController;
use App\Http\Middleware\EnsureCustomerAccount;
use Illuminate\Support\Facades\Route;

Route::prefix('licensing')->middleware('throttle:60,1')->group(function () {
    Route::post('pair', [OnlineLicenseController::class, 'pair']);
    Route::get('delivery', [OnlineLicenseController::class, 'delivery']);
    Route::post('acknowledge', [OnlineLicenseController::class, 'acknowledge']);
    Route::get('worker/pending', [OnlineLicenseController::class, 'pending']);
    Route::post('worker/complete', [OnlineLicenseController::class, 'complete']);
});
Route::middleware(['auth:sanctum', 'active', 'verified', 'throttle:activation', EnsureCustomerAccount::class])->group(function () {
    Route::post('account/connect-device', [OnlineLicenseController::class, 'confirm']);
    Route::post('account/refill-device', [OnlineLicenseController::class, 'refill']);
});
