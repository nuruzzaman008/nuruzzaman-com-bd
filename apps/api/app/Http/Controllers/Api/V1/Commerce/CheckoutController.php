<?php

namespace App\Http\Controllers\Api\V1\Commerce;

use App\Http\Controllers\Controller;
use App\Http\Requests\Commerce\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Services\Commerce\CartService;
use App\Services\Commerce\CheckoutService;
use App\Services\Payments\PaymentProcessor;
use Illuminate\Http\JsonResponse;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly CartService $carts,
        private readonly CheckoutService $checkout,
        private readonly PaymentProcessor $payments,
    ) {}

    /**
     * Creates the order and the gateway session in one call so the browser only
     * ever receives a redirect URL it cannot influence.
     */
    public function __invoke(CheckoutRequest $request): JsonResponse
    {
        $user = $request->user();
        $cart = $this->carts->forUser($user);

        $order = $this->checkout->createOrder(
            $cart,
            $user,
            $request->safe()->only(['name', 'email', 'phone']),
            $request->acceptedTerms(),
            $request->ip(),
        );

        $session = $this->payments->startPayment($order);

        return response()->json([
            'data' => [
                'order' => (new OrderResource($order->load('items')))->resolve($request),
                'payment_reference' => $session['payment']->reference,
                'redirect_url' => $session['redirect_url'],
            ],
        ], 201);
    }
}
