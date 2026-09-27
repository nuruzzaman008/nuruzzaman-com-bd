<?php

use App\Http\Controllers\Api\V1\Admin\GrowthHubController as Hub;
use Illuminate\Support\Facades\Route;

Route::prefix('admin/growth-hub')->middleware(['auth:sanctum', 'active', 'verified', 'role:super_admin', 'throttle:60,1,growth-hub:'])->group(function () {
    Route::get('dashboard', [Hub::class, 'dashboard']);
    Route::get('preferences', [Hub::class, 'preferences']);
    Route::put('preferences', [Hub::class, 'savePreferences']);
    Route::get('reviews', [Hub::class, 'reviews']);
    Route::put('reviews', [Hub::class, 'saveReview']);
    Route::get('providers', [Hub::class, 'providers']);
    Route::post('providers', [Hub::class, 'saveProvider']);
    Route::put('providers/{id}', [Hub::class, 'saveProvider'])->whereNumber('id');
    Route::delete('providers/{id}', [Hub::class, 'deleteProvider'])->whereNumber('id');
    Route::post('providers/{id}/test', [Hub::class, 'testProvider'])->whereNumber('id')->middleware('throttle:5,1,growth-ai:');
    Route::get('ai-history', [Hub::class, 'aiHistory']);
    Route::get('conversations', [Hub::class, 'conversations']);
    Route::post('conversations', [Hub::class, 'saveConversation']);
    Route::patch('conversations/{id}', [Hub::class, 'saveConversation'])->whereNumber('id');
    Route::delete('conversations/{id}', [Hub::class, 'deleteConversation'])->whereNumber('id');
    Route::get('conversations/{id}/messages', [Hub::class, 'messages'])->whereNumber('id');
    Route::post('conversations/{id}/messages', [Hub::class, 'sendMessage'])->whereNumber('id')->middleware('throttle:5,1,growth-ai:');
    Route::get('{kind}', [Hub::class, 'index'])->whereIn('kind', ['goals', 'tasks', 'ideas']);
    Route::post('{kind}', [Hub::class, 'store'])->whereIn('kind', ['goals', 'tasks', 'ideas']);
    Route::put('{kind}/{id}', [Hub::class, 'update'])->whereIn('kind', ['goals', 'tasks', 'ideas'])->whereNumber('id');
    Route::delete('{kind}/{id}', [Hub::class, 'destroy'])->whereIn('kind', ['goals', 'tasks', 'ideas'])->whereNumber('id');
});
