<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\Role as RoleEnum;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Services\Commerce\CartService;
use App\Support\Audit;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class RegisterController extends Controller
{
    public function __construct(private readonly CartService $carts) {}

    public function __invoke(RegisterRequest $request): JsonResponse
    {
        $user = DB::transaction(function () use ($request) {
            $user = User::create($request->safe()->only(['name', 'email', 'password', 'phone']));
            $user->profile()->create(['display_name' => $user->name]);

            // Everyone starts as a customer; staff roles are granted explicitly.
            $customer = Role::query()->where('name', RoleEnum::Customer->value)->first();

            if ($customer) {
                $user->roles()->attach($customer);
            }

            return $user;
        });

        event(new Registered($user));

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        // Anything the visitor put in a cart before registering follows them in.
        if ($token = $request->cookie('cart_token')) {
            $this->carts->merge($this->carts->forToken($token), $user);
        }

        Audit::record('auth.registered', $user, [], $user->getKey());

        return (new UserResource($user->load('profile', 'roles')))
            ->response()
            ->setStatusCode(201);
    }
}
