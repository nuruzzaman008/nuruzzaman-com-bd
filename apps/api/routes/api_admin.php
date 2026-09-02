<?php

use App\Http\Controllers\Api\V1\Admin;
use Illuminate\Support\Facades\Route;

/*
| Admin surface. The role gate below only keeps unrelated accounts out of the
| area; the real decisions are made by policies and permission checks inside
| each controller.
*/

Route::middleware([
    'auth:sanctum',
    'active',
    'verified',
    'role:super_admin,admin,editor,instructor,support',
])->prefix('admin')->group(function () {
    Route::get('dashboard', Admin\DashboardController::class);
    Route::get('audit-logs', Admin\AuditLogController::class);

    Route::get('settings', [Admin\SettingController::class, 'index']);
    Route::put('settings', [Admin\SettingController::class, 'update']);

    // ---------------------------------------------------------------- content
    Route::get('posts', [Admin\PostController::class, 'index']);
    Route::post('posts', [Admin\PostController::class, 'store']);
    Route::get('posts/{post:id}', [Admin\PostController::class, 'show']);
    Route::patch('posts/{post:id}', [Admin\PostController::class, 'update']);
    Route::post('posts/{post:id}/transition', [Admin\PostController::class, 'transition']);
    Route::get('posts/{post:id}/revisions', [Admin\PostController::class, 'revisions']);
    Route::post('posts/{post:id}/revisions/{revision}/restore', [Admin\PostController::class, 'restore']);
    Route::delete('posts/{post:id}', [Admin\PostController::class, 'destroy']);

    Route::get('pages', [Admin\PageController::class, 'index']);
    Route::post('pages', [Admin\PageController::class, 'store']);
    Route::get('pages/{page:id}', [Admin\PageController::class, 'show']);
    Route::patch('pages/{page:id}', [Admin\PageController::class, 'update']);
    Route::post('pages/{page:id}/transition', [Admin\PageController::class, 'transition']);
    Route::post('pages/{page:id}/legal-review', [Admin\PageController::class, 'recordLegalReview']);
    Route::delete('pages/{page:id}', [Admin\PageController::class, 'destroy']);

    Route::get('categories', [Admin\TaxonomyController::class, 'categories']);
    Route::post('categories', [Admin\TaxonomyController::class, 'storeCategory']);
    Route::patch('categories/{category:id}', [Admin\TaxonomyController::class, 'updateCategory']);
    Route::delete('categories/{category:id}', [Admin\TaxonomyController::class, 'destroyCategory']);
    Route::get('tags', [Admin\TaxonomyController::class, 'tags']);
    Route::post('tags', [Admin\TaxonomyController::class, 'storeTag']);
    Route::delete('tags/{tag:id}', [Admin\TaxonomyController::class, 'destroyTag']);

    Route::get('media', [Admin\MediaController::class, 'index']);
    Route::post('media', [Admin\MediaController::class, 'store']);
    Route::patch('media/{medium:id}', [Admin\MediaController::class, 'update']);
    Route::delete('media/{medium:id}', [Admin\MediaController::class, 'destroy']);

    Route::get('redirects', [Admin\RedirectController::class, 'index']);
    Route::post('redirects', [Admin\RedirectController::class, 'store']);
    Route::patch('redirects/{redirect:id}', [Admin\RedirectController::class, 'update']);
    Route::delete('redirects/{redirect:id}', [Admin\RedirectController::class, 'destroy']);
});

Route::middleware([
    'auth:sanctum',
    'active',
    'verified',
    'role:super_admin,admin,editor,instructor,support',
])->prefix('admin')->group(function () {
    // --------------------------------------------------------------- commerce
    Route::get('products', [Admin\ProductController::class, 'index']);
    Route::post('products', [Admin\ProductController::class, 'store']);
    Route::get('products/{product:id}', [Admin\ProductController::class, 'show']);
    Route::patch('products/{product:id}', [Admin\ProductController::class, 'update']);
    Route::post('products/{product:id}/transition', [Admin\ProductController::class, 'transition']);
    Route::post('products/{product:id}/variants', [Admin\ProductVariantController::class, 'store']);
    Route::patch('products/{product:id}/variants/{variant:id}', [Admin\ProductVariantController::class, 'update']);
    Route::post('products/{product:id}/variants/{variant:id}/prices', [Admin\ProductVariantController::class, 'storePrice']);
    Route::put('products/{product:id}/variants/{variant:id}/downloads', [Admin\ProductVariantController::class, 'syncDownloads']);

    Route::get('coupons', [Admin\CouponController::class, 'index']);
    Route::post('coupons', [Admin\CouponController::class, 'store']);
    Route::patch('coupons/{coupon:id}', [Admin\CouponController::class, 'update']);
    Route::delete('coupons/{coupon:id}', [Admin\CouponController::class, 'destroy']);

    Route::get('orders', [Admin\OrderController::class, 'index']);
    Route::get('orders/{number}', [Admin\OrderController::class, 'show']);
    Route::post('orders/{number}/transition', [Admin\OrderController::class, 'transition']);
    Route::post('orders/{number}/refulfill', [Admin\OrderController::class, 'refulfill']);
    Route::post('orders/{number}/refunds', [Admin\RefundController::class, 'store']);
    Route::post('refunds/{refund:id}/approve', [Admin\RefundController::class, 'approve'])
        ->middleware('idempotent:refund');
    Route::post('refunds/{refund:id}/reject', [Admin\RefundController::class, 'reject']);

    Route::get('download-assets', [Admin\DownloadAssetController::class, 'index']);
    Route::post('download-assets', [Admin\DownloadAssetController::class, 'store']);
    Route::patch('download-assets/{downloadAsset:id}', [Admin\DownloadAssetController::class, 'update']);
    Route::post('download-assets/{downloadAsset:id}/file', [Admin\DownloadAssetController::class, 'upload']);
});

Route::middleware([
    'auth:sanctum',
    'active',
    'verified',
    'role:super_admin,admin,editor,instructor,support',
])->prefix('admin')->group(function () {
    // -------------------------------------------------------------------- lms
    Route::get('courses', [Admin\CourseController::class, 'index']);
    Route::post('courses', [Admin\CourseController::class, 'store']);
    Route::get('courses/{course:id}', [Admin\CourseController::class, 'show']);
    Route::patch('courses/{course:id}', [Admin\CourseController::class, 'update']);
    Route::post('courses/{course:id}/transition', [Admin\CourseController::class, 'transition']);
    Route::put('courses/{course:id}/instructors', [Admin\CourseController::class, 'syncInstructors']);

    Route::post('courses/{course:id}/sections', [Admin\CourseStructureController::class, 'storeSection']);
    Route::patch('courses/{course:id}/sections/{section:id}', [Admin\CourseStructureController::class, 'updateSection']);
    Route::delete('courses/{course:id}/sections/{section:id}', [Admin\CourseStructureController::class, 'destroySection']);
    Route::post('courses/{course:id}/lessons', [Admin\CourseStructureController::class, 'storeLesson']);
    Route::patch('courses/{course:id}/lessons/{lesson:id}', [Admin\CourseStructureController::class, 'updateLesson']);
    Route::delete('courses/{course:id}/lessons/{lesson:id}', [Admin\CourseStructureController::class, 'destroyLesson']);
    Route::put('courses/{course:id}/reorder', [Admin\CourseStructureController::class, 'reorder']);

    Route::get('enrollments', [Admin\EnrollmentController::class, 'index']);
    Route::post('enrollments', [Admin\EnrollmentController::class, 'store']);
    Route::post('enrollments/{enrollment:id}/revoke', [Admin\EnrollmentController::class, 'revoke']);

    Route::get('course-reviews', [Admin\ReviewModerationController::class, 'index']);
    Route::post('course-reviews/{review:id}/moderate', [Admin\ReviewModerationController::class, 'moderate']);

    // ------------------------------------------------------- people and support
    Route::get('users', [Admin\UserController::class, 'index']);
    Route::get('users/{user:id}', [Admin\UserController::class, 'show']);
    Route::patch('users/{user:id}', [Admin\UserController::class, 'update']);
    Route::put('users/{user:id}/roles', [Admin\UserController::class, 'syncRoles'])
        ->middleware('password.confirm');

    Route::get('activation-requests', [Admin\ActivationRequestController::class, 'index']);
    Route::get('activation-requests/{reference}', [Admin\ActivationRequestController::class, 'show']);
    Route::post('activation-requests/{reference}/transition', [Admin\ActivationRequestController::class, 'transition']);

    Route::get('support-tickets', [Admin\SupportTicketController::class, 'index']);
    Route::get('support-tickets/{reference}', [Admin\SupportTicketController::class, 'show']);
    Route::post('support-tickets/{reference}/replies', [Admin\SupportTicketController::class, 'reply']);
    Route::patch('support-tickets/{reference}', [Admin\SupportTicketController::class, 'update']);
});
