<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Requests\Account\ActivationRequestStoreRequest;
use App\Http\Resources\ActivationRequestResource;
use App\Models\ActivationRequest;
use App\Models\Order;
use App\Services\Licensing\ActivationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ActivationRequestController extends Controller
{
    public function __construct(private readonly ActivationService $activation) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $requests = $request->user()->activationRequests()
            ->with(['order', 'license'])
            ->latest('id')
            ->paginate(20);

        return ActivationRequestResource::collection($requests);
    }

    public function store(ActivationRequestStoreRequest $request): ActivationRequestResource
    {
        $order = Order::query()->where('number', $request->validated('order_number'))->firstOrFail();

        $activationRequest = $this->activation->submit(
            $request->user(),
            $order,
            $request->validated(),
        );

        return new ActivationRequestResource($activationRequest->load(['order', 'license', 'events']));
    }

    public function show(Request $request, string $reference): ActivationRequestResource
    {
        $activationRequest = ActivationRequest::query()
            ->where('reference', $reference)
            ->with(['order', 'license', 'events'])
            ->firstOrFail();

        $this->authorize('view', $activationRequest);

        return new ActivationRequestResource($activationRequest);
    }
}
