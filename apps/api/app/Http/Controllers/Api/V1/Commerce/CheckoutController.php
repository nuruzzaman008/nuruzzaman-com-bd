<?php

namespace App\Http\Controllers\Api\V1\Commerce;

use App\Http\Controllers\Controller;
use App\Http\Requests\Commerce\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Services\Commerce\CartService;
use App\Services\Commerce\CheckoutService;
use Illuminate\Http\JsonResponse;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly CartService $carts,
        private readonly CheckoutService $checkout,
    ) {}

    /**
     * Creates a priced order before the customer chooses a payment method.
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

        return response()->json([
            'data' => [
                'order' => (new OrderResource($order->load('items')))->resolve($request),
                'payment_reference' => null,
                'redirect_url' => '/checkout/payment/'.$order->number,
            ],
        ], 201);
    }
}
