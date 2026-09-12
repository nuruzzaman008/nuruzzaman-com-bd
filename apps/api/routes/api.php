<?php

use App\Http\Controllers\Api\V1\Auth;
use App\Http\Controllers\Api\V1\Commerce;
use App\Http\Controllers\Api\V1\LessonVideoController;
use App\Http\Controllers\Api\V1\PublicApi;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

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

    /*
      Sessions, named outright.

      These two are the only browser navigations this API serves. Every other
      route here is called by the site with an Origin that Sanctum recognises,
      which is the only reason any of them has a session at all - and Google's
      redirect back carries no such header, so the callback arrived with no
      session to read the state from and nowhere to sign anybody in. It failed
      with "Session store not set on request".

      So Sanctum's stateful wrapper comes off these two and the session
      middleware is listed instead. Both halves then use the same session
      whether or not a browser feels like sending a Referer.

      The callback sits outside throttle:auth on purpose: Google sends the
      visitor here once per sign-in, and the limiter in front of the password
      endpoints counts by address, so a household finishing three sign-ins in a
      minute would find the fourth refused with nothing to explain it. A
      replayed callback is useless anyway - the state is single use and
      Google's code is too.
    */
    Route::middleware([EncryptCookies::class, AddQueuedCookiesToResponse::class, StartSession::class])
        ->withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
        ->group(function () {
            Route::get('auth/google/redirect', [Auth\GoogleAuthController::class, 'redirect'])
                ->middleware('throttle:auth');

            Route::get('auth/google/callback', [Auth\GoogleAuthController::class, 'callback'])
                ->middleware('throttle:api');
        });

    Route::post('auth/logout', [Auth\LoginController::class, 'destroy'])->middleware('auth:sanctum');

    // signed:relative, not signed. The link is built with absolute: false,
    // because the browser follows it at nuruzzaman.com.bd and the API answers
    // at api.nuruzzaman.com.bd - a signature covering the host could never
    // match. Plain 'signed' validates as absolute, so every link ever issued
    // was refused with 403, which the page reported as an expired link: the
    // remedy it offered was a new link, which failed in exactly the same way.
    Route::get('auth/verify-email/{id}/{hash}', [Auth\EmailVerificationController::class, 'verify'])
        ->middleware(['auth:sanctum', 'signed:relative', 'throttle:verify-email'])
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
    Route::get('lesson-video/{lesson:id}', [LessonVideoController::class, 'stream'])->name('lesson.video.stream');
    require __DIR__.'/api_licensing.php';
    require __DIR__.'/api_admin.php';
});
