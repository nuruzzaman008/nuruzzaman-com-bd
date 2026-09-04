<?php

use App\Http\Controllers\Api\V1\Account;
use App\Http\Controllers\Api\V1\Auth;
use App\Http\Controllers\Api\V1\Commerce;
use App\Http\Controllers\Api\V1\Learn;
use App\Http\Controllers\Api\V1\PublicApi;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1
|--------------------------------------------------------------------------
|
| Everything the browser calls is same-origin: Nginx sends /api and /sanctum
| to Laravel and everything else to Next.js. Public Server Components call the
| same routes over the internal network.
|
| Authorisation is enforced here and again in policies at the data source.
|
*/

Route::prefix('v1')->group(function () {
    // ---------------------------------------------------------------- public
    Route::middleware('throttle:api')->group(function () {
        Route::get('site/settings', [PublicApi\SiteController::class, 'settings']);
        Route::get('site/sitemap', [PublicApi\SiteController::class, 'sitemap']);
        Route::get('site/redirects', [PublicApi\SiteController::class, 'redirects']);
        Route::get('site/redirect', [PublicApi\SiteController::class, 'resolveRedirect']);

        Route::get('posts', [PublicApi\PostController::class, 'index']);
        Route::get('posts/{slug}', [PublicApi\PostController::class, 'show']);
        Route::get('posts/{slug}/related', [PublicApi\PostController::class, 'related']);
        Route::get('posts/{slug}/comments', [PublicApi\PostCommentController::class, 'index']);

        Route::get('categories', [PublicApi\TaxonomyController::class, 'categories']);
        Route::get('categories/{slug}', [PublicApi\TaxonomyController::class, 'category']);
        Route::get('authors', [PublicApi\TaxonomyController::class, 'authors']);
        Route::get('authors/{slug}', [PublicApi\TaxonomyController::class, 'author']);

        Route::get('pages/{slug}', [PublicApi\PageController::class, 'show']);

        Route::get('products', [PublicApi\ProductController::class, 'index']);
        Route::get('products/{slug}', [PublicApi\ProductController::class, 'show']);

        Route::get('courses', [PublicApi\CourseController::class, 'index']);
        Route::get('courses/{slug}', [PublicApi\CourseController::class, 'show']);
        Route::get('courses/{courseSlug}/preview/{lessonSlug}', [PublicApi\CourseController::class, 'preview']);

        Route::get('releases', [PublicApi\ReleaseController::class, 'index']);
        Route::get('releases/{slug}', [PublicApi\ReleaseController::class, 'show']);

        Route::get('verify/{verificationId}', PublicApi\CertificateVerificationController::class);
    });

    Route::get('search', PublicApi\SearchController::class)->middleware('throttle:search');
    Route::post('contact', PublicApi\ContactController::class)->middleware('throttle:public-forms');

    // ------------------------------------------------------------------ auth
    Route::middleware('throttle:auth')->group(function () {
        Route::post('auth/register', Auth\RegisterController::class);
        Route::post('auth/login', [Auth\LoginController::class, 'store']);
        Route::post('auth/forgot-password', [Auth\PasswordController::class, 'forgot']);
        Route::post('auth/reset-password', [Auth\PasswordController::class, 'reset']);
    });

    Route::post('auth/logout', [Auth\LoginController::class, 'destroy'])->middleware('auth:sanctum');

    Route::get('auth/verify-email/{id}/{hash}', [Auth\EmailVerificationController::class, 'verify'])
        ->middleware(['auth:sanctum', 'signed', 'throttle:auth'])
        ->name('verification.verify');

    Route::post('auth/verify-email/resend', [Auth\EmailVerificationController::class, 'resend'])
        ->middleware(['auth:sanctum', 'throttle:auth']);

    // ------------------------------------------------------------------ cart
    Route::middleware('throttle:api')->prefix('cart')->group(function () {
        Route::get('/', [Commerce\CartController::class, 'show']);
        Route::post('items', [Commerce\CartController::class, 'store']);
        Route::patch('items/{variant}', [Commerce\CartController::class, 'update']);
        Route::delete('items/{variant}', [Commerce\CartController::class, 'destroy']);
        Route::post('coupon', [Commerce\CartController::class, 'applyCoupon']);
        Route::delete('coupon', [Commerce\CartController::class, 'removeCoupon']);
    });

    // -------------------------------------------------------------- payments
    // The IPN is the only endpoint that can settle money. It is CSRF-exempt
    // because it is a server-to-server post, and it is validated, fingerprinted
    // and rate limited rather than trusted.
    Route::post('payments/sslcommerz/ipn', [Commerce\PaymentCallbackController::class, 'ipn'])
        ->middleware('throttle:ipn');

    Route::get('payments/sandbox/{reference}', [Commerce\PaymentCallbackController::class, 'sandbox'])
        ->middleware('throttle:ipn');

    require __DIR__.'/api_account.php';
    require __DIR__.'/api_admin.php';
});
