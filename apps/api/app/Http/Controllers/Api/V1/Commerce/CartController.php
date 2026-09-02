<?php

namespace App\Http\Controllers\Api\V1\Commerce;

use App\Http\Controllers\Controller;
use App\Http\Resources\CartResource;
use App\Models\Cart;
use App\Models\ProductVariant;
use App\Services\Commerce\CartService;
use App\Services\Commerce\PricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Anonymous visitors get a signed, HttpOnly cart cookie holding only an opaque
 * token. Prices, discounts and totals are always recomputed on the server.
 */
class CartController extends Controller
{
    private const COOKIE = 'cart_token';

    public function __construct(
        private readonly CartService $carts,
        private readonly PricingService $pricing,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $cart = $this->resolve($request);

        return $this->respond($request, $cart);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'quantity' => ['sometimes', 'integer', 'min:1', 'max:99'],
        ]);

        $cart = $this->carts->addItem(
            $this->resolve($request),
            ProductVariant::with('product')->findOrFail($validated['variant_id']),
            $validated['quantity'] ?? 1,
        );

        return $this->respond($request, $cart, 201);
    }

    public function update(Request $request, int $variantId): JsonResponse
    {
        $validated = $request->validate(['quantity' => ['required', 'integer', 'min:0', 'max:99']]);

        $cart = $this->carts->updateQuantity(
            $this->resolve($request),
            ProductVariant::with('product')->findOrFail($variantId),
            $validated['quantity'],
        );

        return $this->respond($request, $cart);
    }

    public function destroy(Request $request, int $variantId): JsonResponse
    {
        $cart = $this->carts->removeItem(
            $this->resolve($request),
            ProductVariant::findOrFail($variantId),
        );

        return $this->respond($request, $cart);
    }

    public function applyCoupon(Request $request): JsonResponse
    {
        $validated = $request->validate(['code' => ['required', 'string', 'max:48']]);

        $cart = $this->carts->applyCoupon($this->resolve($request), $validated['code'], $request->user());

        return $this->respond($request, $cart);
    }

    public function removeCoupon(Request $request): JsonResponse
    {
        return $this->respond($request, $this->carts->removeCoupon($this->resolve($request)));
    }

    private function resolve(Request $request): Cart
    {
        return $request->user()
            ? $this->carts->forUser($request->user())
            : $this->carts->forToken($request->cookie(self::COOKIE));
    }

    private function respond(Request $request, Cart $cart, int $status = 200): JsonResponse
    {
        $totals = $this->pricing->totalsFor($cart, $request->user());
        $response = (new CartResource($cart, $totals))->response()->setStatusCode($status);

        if (! $request->user()) {
            $response->withCookie(Cookie::create(self::COOKIE, $cart->token)
                ->withHttpOnly()
                ->withPath('/')
                ->withSameSite('lax')
                ->withSecure($request->isSecure())
                ->withExpires(now()->addDays((int) config('nb.commerce.cart_lifetime_days'))->toDateTime()));
        }

        return $response;
    }
}
