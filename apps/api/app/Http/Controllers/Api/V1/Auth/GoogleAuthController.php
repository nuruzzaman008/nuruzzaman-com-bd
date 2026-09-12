<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\Role as RoleEnum;
use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\Commerce\CartService;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Sign in with Google, for customers.
 *
 * Written against Google's endpoints directly rather than through Socialite:
 * this host has proc_open in disable_functions, so Composer cannot install a
 * package here at all, and the authorization-code flow is small enough that a
 * dependency would buy little.
 *
 * The tokens are exchanged server to server over TLS with Google, and the
 * profile is read from Google's own userinfo endpoint with the access token we
 * were just handed. Nothing arrives via the browser that is trusted, so there
 * is no ID token signature to verify and no JWT library to carry.
 *
 * STAFF MAY NOT USE THIS. A staff account reached through Google is only as
 * safe as that Google account, and it would walk straight past the three-strike
 * lock on the password path. Staff sign in at /nb-staff with a password. The
 * refusal is here, on the server, rather than in whether a button is drawn.
 */
class GoogleAuthController extends Controller
{
    /** Any of these on an account means the password page, not this one. */
    private const STAFF_ROLES = ['super_admin', 'admin', 'editor', 'instructor', 'support'];

    private const STATE_KEY = 'google_oauth_state';

    public function __construct(private readonly CartService $carts) {}

    public function redirect(Request $request): RedirectResponse
    {
        $this->ensureConfigured();

        // Single use, and checked on the way back: without it, anyone could
        // hand a visitor a prepared callback URL and sign them into an account
        // of the attacker's choosing.
        $state = Str::random(40);
        $request->session()->put(self::STATE_KEY, $state);

        return redirect()->away('https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query([
            'client_id' => config('services.google.client_id'),
            'redirect_uri' => config('services.google.redirect'),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            // So a shared computer does not silently reuse the last account.
            'prompt' => 'select_account',
        ]));
    }

    public function callback(Request $request): RedirectResponse
    {
        $this->ensureConfigured();

        $expected = $request->session()->pull(self::STATE_KEY);
        $given = (string) $request->query('state');

        if (! $expected || ! hash_equals((string) $expected, $given)) {
            return $this->back('google_failed');
        }

        if (! $request->filled('code')) {
            // Covers the visitor pressing "cancel" on Google's screen.
            return $this->back('google_cancelled');
        }

        $token = Http::asForm()->timeout(15)->post('https://oauth2.googleapis.com/token', [
            'code' => (string) $request->query('code'),
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'redirect_uri' => config('services.google.redirect'),
            'grant_type' => 'authorization_code',
        ]);

        if (! $token->successful() || ! $token->json('access_token')) {
            return $this->back('google_failed');
        }

        $profile = Http::withToken((string) $token->json('access_token'))
            ->timeout(15)
            ->get('https://www.googleapis.com/oauth2/v3/userinfo');

        $email = Str::lower((string) $profile->json('email'));

        /*
          The verified flag is not a formality. Without it, anyone able to
          create a Google account claiming an address they do not own could
          sign in as whoever holds that address here.
        */
        if (! $profile->successful() || $profile->json('email_verified') !== true || ! $email) {
            return $this->back('google_unverified');
        }

        $googleId = (string) $profile->json('sub');

        $user = User::query()->where('google_id', $googleId)->first()
            ?? User::query()->whereRaw('LOWER(email) = ?', [$email])->first();

        if ($user && $user->roles()->whereIn('name', self::STAFF_ROLES)->exists()) {
            Audit::record('auth.google_refused_staff', $user, [], $user->getKey());

            return $this->back('staff_password_only');
        }

        if ($user && ! $user->isActive()) {
            return $this->back('account_inactive');
        }

        $user ??= $this->register($email, $googleId, (string) $profile->json('name'));

        // Links an account that already existed under this address. Google has
        // just confirmed the person controls it.
        if (! $user->google_id) {
            $user->forceFill(['google_id' => $googleId])->save();
        }

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        if ($cart = $request->cookie('cart_token')) {
            $this->carts->merge($this->carts->forToken($cart), $user);
        }

        Audit::record('auth.login', $user, ['via' => 'google'], $user->getKey());

        return redirect()->away($this->frontend().'/account');
    }

    private function register(string $email, string $googleId, string $name): User
    {
        return DB::transaction(function () use ($email, $googleId, $name) {
            $user = User::create([
                'name' => $name !== '' ? $name : Str::before($email, '@'),
                'email' => $email,
                // Never used to sign in. A password is set the ordinary way, by
                // asking for a reset, if they ever want one.
                'password' => Str::random(40),
                'status' => 'active',
            ]);

            $user->forceFill([
                'google_id' => $googleId,
                // Google verified the address before we were told about it.
                'email_verified_at' => now(),
            ])->save();

            $user->profile()->create(['display_name' => $user->name]);

            // The same role registration grants. Nothing here can produce staff.
            if ($customer = Role::query()->where('name', RoleEnum::Customer->value)->first()) {
                $user->roles()->attach($customer);
            }

            Audit::record('auth.registered', $user, ['via' => 'google'], $user->getKey());

            return $user;
        });
    }

    /** Absent credentials mean the route does not exist, rather than fails. */
    private function ensureConfigured(): void
    {
        abort_unless(
            config('services.google.client_id') && config('services.google.client_secret'),
            404,
        );
    }

    private function frontend(): string
    {
        return rtrim((string) env('FRONTEND_URL', config('nb.site.url')), '/');
    }

    private function back(string $reason): RedirectResponse
    {
        return redirect()->away($this->frontend().'/login?error='.$reason);
    }
}
