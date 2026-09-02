<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrderController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = $request->user()->orders()
            ->with(['items', 'invoice'])
            ->latest('id')
            ->paginate(15);

        return OrderResource::collection($orders);
    }

    public function show(Request $request, string $number): OrderResource
    {
        $order = Order::query()
            ->where('number', $number)
            ->with(['items', 'invoice', 'statusEvents'])
            ->firstOrFail();

        $this->authorize('view', $order);

        return new OrderResource($order);
    }

    public function invoice(Request $request, string $number): JsonResponse
    {
        $order = Order::query()->where('number', $number)->with('invoice')->firstOrFail();
        $this->authorize('view', $order);

        abort_unless($order->invoice, 404, 'No invoice has been issued for this order yet.');

        return response()->json([
            'data' => [
                'number' => $order->invoice->number,
                'issued_at' => $order->invoice->issued_at?->toIso8601String(),
                'currency' => $order->invoice->currency,
                'total_minor' => (int) $order->invoice->total_minor,
                'snapshot' => $order->invoice->snapshot,
            ],
        ]);
    }
}
