<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ActivationRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ActivationRequestResource;
use App\Mail\ActivationStatusMail;
use App\Models\ActivationRequest;
use App\Services\Licensing\ActivationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Mail;

/**
 * The support-side view of the Phase 1 activation workflow. Reviewers move a
 * request through its states and paste back the safe customer response that
 * the offline vendor process produced. No key material passes through here.
 */
class ActivationRequestController extends Controller
{
    public function __construct(private readonly ActivationService $activation) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', ActivationRequest::class);

        $validated = $request->validate([
            'status' => ['sometimes', 'string', 'in:'.implode(',', ActivationRequestStatus::values())],
            'q' => ['sometimes', 'string', 'max:64'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $requests = ActivationRequest::query()
            ->with(['user:id,name,email', 'order:id,number', 'license:id,license_code'])
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['q'] ?? null, fn ($query, $term) => $query->where('reference', 'like', '%'.$term.'%'))
            ->latest('id')
            ->paginate($validated['per_page'] ?? 25);

        return ActivationRequestResource::collection($requests);
    }

    public function show(string $reference): ActivationRequestResource
    {
        $activationRequest = ActivationRequest::query()
            ->where('reference', $reference)
            ->with(['user', 'order', 'license', 'events.actor:id,name'])
            ->firstOrFail();

        $this->authorize('review', $activationRequest);

        return new ActivationRequestResource($activationRequest);
    }

    public function transition(Request $request, string $reference): ActivationRequestResource
    {
        $activationRequest = ActivationRequest::query()->where('reference', $reference)->firstOrFail();
        $this->authorize('review', $activationRequest);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', ActivationRequestStatus::values())],
            'note' => ['nullable', 'string', 'max:512'],
            // Free text the customer will read. Reviewers are instructed never
            // to paste a token, key or recovery blob here.
            'vendor_response' => ['nullable', 'string', 'max:4000'],
            'internal_note' => ['nullable', 'string', 'max:4000'],
            'notify' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['internal_note'])) {
            $activationRequest->update(['internal_note' => $validated['internal_note']]);
        }

        $updated = $this->activation->transition(
            $activationRequest,
            ActivationRequestStatus::from($validated['status']),
            $request->user(),
            $validated['note'] ?? null,
            $validated['vendor_response'] ?? null,
        );

        if (($validated['notify'] ?? true) && $updated->user?->email) {
            Mail::to($updated->user->email)->queue(new ActivationStatusMail($updated));
        }

        return new ActivationRequestResource($updated->load(['order', 'license', 'events']));
    }
}
