<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\Commerce\CartService;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    public function __construct(private readonly CartService $carts) {}

    public function store(LoginRequest $request): JsonResponse
    {
        $credentials = $request->safe()->only(['email', 'password']);

        if (! Auth::attempt($credentials, (bool) $request->boolean('remember'))) {
            Audit::record('auth.login_failed', null, ['email' => $credentials['email']]);

            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        $user = $request->user();

        if (! $user->isActive()) {
            Auth::logout();

            throw ValidationException::withMessages(['email' => 'This account is not active.']);
        }

        $request->session()->regenerate();

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        if ($token = $request->cookie('cart_token')) {
            $this->carts->merge($this->carts->forToken($token), $user);
        }

        Audit::record('auth.login', $user, [], $user->getKey());

        return (new UserResource($user->load('profile', 'roles')))->response();
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        Audit::record('auth.logout', $user, [], $user?->getKey());

        return response()->json(['message' => 'Signed out.']);
    }
}
