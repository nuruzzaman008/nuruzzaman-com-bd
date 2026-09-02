<?php

namespace App\Services\Licensing;

use App\Enums\ActivationRequestStatus;
use App\Exceptions\DomainException;
use App\Models\ActivationRequest;
use App\Models\Order;
use App\Models\SoftwareLicense;
use App\Models\User;
use App\Support\Audit;
use App\Support\MachineIdentifier;
use App\Support\Reference;
use Illuminate\Support\Facades\DB;

/**
 * Phase 1 activation workflow.
 *
 * The website verifies that the customer owns a paid order, records the request
 * with the Machine ID encrypted, and lets a support user carry the safe vendor
 * response back. Nothing here issues, signs or stores a token or key: that
 * happens in the offline vendor process, outside this application.
 */
class ActivationService
{
    public function submit(User $user, Order $order, array $input): ActivationRequest
    {
        if ($order->user_id !== $user->getKey()) {
            throw DomainException::forbidden('This order does not belong to you.');
        }

        if (! $order->status->grantsEntitlements()) {
            throw new DomainException('Activation needs a paid order.');
        }

        $machineId = trim((string) $input['machine_id']);

        if (strlen(MachineIdentifier::normalize($machineId)) < 8) {
            throw new DomainException('That Machine ID does not look valid.');
        }

        $license = $this->resolveLicense($user, $order, $input['license_code'] ?? null);
        $fingerprint = MachineIdentifier::fingerprint($machineId);

        $duplicate = ActivationRequest::query()
            ->where('user_id', $user->getKey())
            ->where('machine_id_fingerprint', $fingerprint)
            ->whereIn('status', [
                ActivationRequestStatus::Submitted->value,
                ActivationRequestStatus::UnderReview->value,
                ActivationRequestStatus::Approved->value,
            ])
            ->exists();

        if ($duplicate) {
            throw DomainException::conflict('You already have an open request for this machine.');
        }

        return DB::transaction(function () use ($user, $order, $license, $machineId, $input) {
            $request = new ActivationRequest([
                'reference' => Reference::activation(),
                'user_id' => $user->getKey(),
                'order_id' => $order->getKey(),
                'software_license_id' => $license?->getKey(),
                'status' => ActivationRequestStatus::Submitted,
                'request_type' => $input['request_type'] ?? 'activation',
                'autocad_version' => $input['autocad_version'] ?? null,
                'windows_version' => $input['windows_version'] ?? null,
                'customer_note' => $input['customer_note'] ?? null,
            ]);
            $request->setMachineId($machineId);
            $request->save();

            $request->events()->create([
                'to_status' => ActivationRequestStatus::Submitted->value,
                'note' => 'Submitted by customer',
                'actor_id' => $user->getKey(),
            ]);

            // Only the masked identifier ever reaches the audit trail.
            Audit::record('activation.submitted', $request, [
                'order' => $order->number,
                'machine_id_masked' => $request->machine_id_masked,
            ], $user->getKey());

            return $request;
        });
    }

    public function transition(
        ActivationRequest $request,
        ActivationRequestStatus $to,
        User $actor,
        ?string $note = null,
        ?string $vendorResponse = null,
    ): ActivationRequest {
        if (! $request->status->allows($to)) {
            throw DomainException::conflict(
                "Cannot move this request from {$request->status->value} to {$to->value}."
            );
        }

        return DB::transaction(function () use ($request, $to, $actor, $note, $vendorResponse) {
            $from = $request->status;

            $request->fill([
                'status' => $to,
                'decided_by' => $actor->getKey(),
                'decided_at' => now(),
                'completed_at' => $to === ActivationRequestStatus::Completed ? now() : $request->completed_at,
            ]);

            if ($vendorResponse !== null) {
                $request->vendor_response = $vendorResponse;
            }

            $request->save();

            $request->events()->create([
                'from_status' => $from->value,
                'to_status' => $to->value,
                'note' => $note,
                'actor_id' => $actor->getKey(),
            ]);

            Audit::record('activation.status_changed', $request, [
                'from' => $from->value,
                'to' => $to->value,
            ], $actor->getKey());

            return $request->refresh();
        });
    }

    private function resolveLicense(User $user, Order $order, ?string $licenseCode): ?SoftwareLicense
    {
        $query = SoftwareLicense::query()->where('user_id', $user->getKey());

        if ($licenseCode) {
            $license = (clone $query)->where('license_code', $licenseCode)->first();

            if (! $license) {
                throw new DomainException('That licence code is not on your account.');
            }

            return $license;
        }

        return (clone $query)->where('order_id', $order->getKey())->first();
    }
}
