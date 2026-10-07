<?php

use App\Http\Controllers\Api\WalletController;
use App\Http\Middleware\AuthenticateWalletDevice;
use Illuminate\Support\Facades\Route;

Route::prefix('wallet')->middleware([AuthenticateWalletDevice::class, 'throttle:120,1'])->group(function () {
    Route::post('connect', [WalletController::class, 'connect']);
    Route::get('balance', [WalletController::class, 'balance']);
    Route::post('sync', [WalletController::class, 'sync']);
    Route::get('history', [WalletController::class, 'history']);
});
