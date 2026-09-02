<?php

use App\Http\Controllers\Api\V1\Account;
use App\Http\Controllers\Api\V1\Auth;
use App\Http\Controllers\Api\V1\Commerce;
use App\Http\Controllers\Api\V1\Learn;
use Illuminate\Support\Facades\Route;

/*
| Authenticated customer and learner routes. Included from routes/api.php
| inside the /api/v1 prefix.
*/

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('me', [Account\ProfileController::class, 'show']);
    Route::patch('me', [Account\ProfileController::class, 'update']);
    Route::post('me/password', [Auth\PasswordController::class, 'update']);
    Route::post('me/confirm-password', [Auth\PasswordController::class, 'confirm']);
    Route::get('me/sessions', [Auth\SessionDeviceController::class, 'index']);
    Route::delete('me/sessions/{id}', [Auth\SessionDeviceController::class, 'destroy']);

    Route::post('checkout', Commerce\CheckoutController::class)
        ->middleware(['throttle:checkout', 'idempotent:checkout']);

    Route::get('payments/{reference}/status', [Commerce\PaymentCallbackController::class, 'status']);

    Route::get('account/orders', [Account\OrderController::class, 'index']);
    Route::get('account/orders/{number}', [Account\OrderController::class, 'show']);
    Route::get('account/orders/{number}/invoice', [Account\OrderController::class, 'invoice']);

    Route::get('account/downloads', [Account\DownloadController::class, 'index']);
    Route::post('account/downloads/{slug}', [Account\DownloadController::class, 'store'])
        ->middleware(['throttle:downloads', 'verified']);

    Route::get('account/courses', [Account\EnrollmentController::class, 'index']);
    Route::get('account/certificates', [Account\EnrollmentController::class, 'certificates']);
    Route::get('account/licenses', [Account\LicenseController::class, 'index']);

    Route::get('account/activation-requests', [Account\ActivationRequestController::class, 'index']);
    Route::post('account/activation-requests', [Account\ActivationRequestController::class, 'store'])
        ->middleware(['throttle:activation', 'verified']);
    Route::get('account/activation-requests/{reference}', [Account\ActivationRequestController::class, 'show']);

    Route::get('account/support-tickets', [Account\SupportTicketController::class, 'index']);
    Route::post('account/support-tickets', [Account\SupportTicketController::class, 'store'])
        ->middleware('throttle:public-forms');
    Route::get('account/support-tickets/{reference}', [Account\SupportTicketController::class, 'show']);
    Route::post('account/support-tickets/{reference}/replies', [Account\SupportTicketController::class, 'reply']);

    // ----------------------------------------------------------------- learn
    Route::prefix('learn')->group(function () {
        Route::get('{courseSlug}/outline', [Learn\LessonController::class, 'outline']);
        Route::get('{courseSlug}/lessons/{lessonSlug}', [Learn\LessonController::class, 'show']);
        Route::post('{courseSlug}/lessons/{lessonSlug}/heartbeat', [Learn\ProgressController::class, 'heartbeat'])
            ->middleware('throttle:progress');
        Route::post('{courseSlug}/lessons/{lessonSlug}/complete', [Learn\ProgressController::class, 'complete'])
            ->middleware('throttle:progress');
        Route::post('{courseSlug}/reviews', [Learn\CourseReviewController::class, 'store']);
    });

    Route::get('quizzes/{quizId}', [Learn\QuizController::class, 'show']);
    Route::post('quizzes/{quizId}/attempts', [Learn\QuizController::class, 'start']);
    Route::post('quiz-attempts/{attemptId}/submit', [Learn\QuizController::class, 'submit']);

    Route::get('assignments/{assignmentId}', [Learn\AssignmentController::class, 'show']);
    Route::post('assignments/{assignmentId}/submissions', [Learn\AssignmentController::class, 'submit']);
});
