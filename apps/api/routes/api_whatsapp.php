<?php

use App\Http\Controllers\Api\V1\Admin\WhatsAppCallController as Calls;
use App\Http\Controllers\Api\V1\Admin\WhatsAppController as Inbox;
use App\Http\Controllers\Api\V1\WhatsAppWebhookController;
use Illuminate\Support\Facades\Route;

Route::get('whatsapp/webhook', [WhatsAppWebhookController::class, 'verify'])->middleware('throttle:120,1,wa-verify:');
Route::post('whatsapp/webhook', [WhatsAppWebhookController::class, 'receive'])->middleware('throttle:600,1,wa-events:');
Route::prefix('admin/whatsapp')->middleware(['auth:sanctum', 'active', 'verified', 'role:admin,super_admin', 'throttle:120,1,wa-inbox:'])->group(function () {
    Route::get('overview', [Inbox::class, 'overview']);
    Route::get('calls', [Calls::class, 'index']);
    Route::get('contacts/{id}/call-permission', [Calls::class, 'permission'])->whereNumber('id');
    Route::post('contacts/{id}/call-permission', [Calls::class, 'requestPermission'])->whereNumber('id')->middleware('throttle:5,1,wa-call-permission:');
    Route::post('contacts/{id}/call', [Calls::class, 'connect'])->whereNumber('id')->middleware('throttle:5,1,wa-call-start:');
    Route::post('calls/{id}/action', [Calls::class, 'action'])->whereNumber('id')->middleware('throttle:30,1,wa-call-action:');
    Route::get('contacts', [Inbox::class, 'contacts']);
    Route::post('contacts', [Inbox::class, 'saveContact']);
    Route::post('contacts/import', [Inbox::class, 'import'])->middleware('role:super_admin');
    Route::patch('contacts/{id}', [Inbox::class, 'saveContact'])->whereNumber('id');
    Route::get('contacts/{id}/messages', [Inbox::class, 'messages'])->whereNumber('id');
    Route::post('contacts/{id}/read', [Inbox::class, 'read'])->whereNumber('id');
    Route::post('contacts/{id}/send', [Inbox::class, 'send'])->whereNumber('id')->middleware('throttle:30,1,wa-send:');
    Route::get('staff', [Inbox::class, 'staff']);
    Route::post('media', [Inbox::class, 'upload'])->middleware('throttle:10,1,wa-media:');
    Route::get('messages/{id}/media', [Inbox::class, 'media'])->whereNumber('id');
    Route::put('settings', [Inbox::class, 'settings'])->middleware('role:super_admin');
    Route::post('connection', [Inbox::class, 'connection'])->middleware(['role:super_admin', 'throttle:5,1,wa-connect:']);
    Route::post('campaign', [Inbox::class, 'campaign'])->middleware(['role:super_admin', 'throttle:5,1,wa-campaign:']);
});
