<?php

namespace App\Providers;

use App\Services\Payments\FakeGateway;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\SslCommerzGateway;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // The real gateway is only bound once credentials exist, so a developer
        // or CI run without secrets still exercises the entire payment path.
        $this->app->bind(PaymentGateway::class, function () {
            return config('sslcommerz.driver') === 'sslcommerz'
                ? new SslCommerzGateway
                : new FakeGateway;
        });
    }

    /** The only database engines this application supports. */
    private const SUPPORTED_DRIVERS = ['mysql', 'mariadb'];

    public function boot(): void
    {
        $this->assertSupportedDatabase();

        Model::shouldBeStrict(! $this->app->isProduction());
        Model::unguard(false);
        Date::use(\Illuminate\Support\Carbon::class);

        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        $this->configureRateLimiting();
        $this->configureNotificationLinks();
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)
            ->by($request->user()?->getAuthIdentifier() ?: $request->ip()));

        RateLimiter::for('auth', fn (Request $request) => [
            Limit::perMinute(5)->by('ip:'.$request->ip()),
            Limit::perMinute(5)->by('email:'.strtolower((string) $request->input('email'))),
        ]);

        RateLimiter::for('checkout', fn (Request $request) => Limit::perMinute(10)
            ->by($request->user()?->getAuthIdentifier() ?: $request->ip()));

        RateLimiter::for('downloads', fn (Request $request) => Limit::perMinute(15)
            ->by($request->user()?->getAuthIdentifier() ?: $request->ip()));

        RateLimiter::for('activation', fn (Request $request) => Limit::perHour(10)
            ->by($request->user()?->getAuthIdentifier() ?: $request->ip()));

        RateLimiter::for('progress', fn (Request $request) => Limit::perMinute(120)
            ->by($request->user()?->getAuthIdentifier() ?: $request->ip()));

        RateLimiter::for('public-forms', fn (Request $request) => Limit::perHour(20)->by($request->ip()));

        RateLimiter::for('search', fn (Request $request) => Limit::perMinute(30)->by($request->ip()));

        // Deliberately generous: the gateway may retry an IPN several times.
        RateLimiter::for('ipn', fn (Request $request) => Limit::perMinute(60)->by($request->ip()));
    }

    /** Verification and reset links point at the Next.js frontend, not the API. */
    private function configureNotificationLinks(): void
    {
        $frontend = rtrim((string) env('FRONTEND_URL', config('nb.site.url')), '/');

        VerifyEmail::createUrlUsing(function ($notifiable) use ($frontend) {
            $signed = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), [
                'id' => $notifiable->getKey(),
                'hash' => sha1($notifiable->getEmailForVerification()),
            ], absolute: false);

            return $frontend.'/account/verify-email?target='.urlencode($signed);
        });

        ResetPassword::createUrlUsing(
            fn ($notifiable, string $token) => $frontend.'/reset-password?token='.$token
                .'&email='.urlencode($notifiable->getEmailForPasswordReset()),
        );
    }

    /**
     * Fails fast if the app is pointed at anything other than MySQL/MariaDB.
     *
     * The hosting runs MySQL, the schema is written for it (InnoDB, utf8mb4,
     * cross-table foreign keys added by ALTER) and the tests run on it. Laravel
     * still merges its own default config underneath ours, so connections we
     * never configured — sqlite, pgsql, sqlsrv — remain selectable by setting
     * DB_CONNECTION. A stray value would otherwise be discovered as strange
     * behaviour much later, so it is refused here with a message that says what
     * to change.
     */
    private function assertSupportedDatabase(): void
    {
        $connection = config('database.default');
        $driver = config("database.connections.{$connection}.driver");

        if ($driver !== null && ! in_array($driver, self::SUPPORTED_DRIVERS, true)) {
            throw new \RuntimeException(
                "This application supports MySQL and MariaDB only; DB_CONNECTION is "
                ."'{$connection}' (driver '{$driver}'). Set DB_CONNECTION=mysql."
            );
        }
    }
}
