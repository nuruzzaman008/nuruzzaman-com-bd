<?php

namespace App\Services\Licensing;

use App\Enums\ActivationRequestStatus;
use App\Exceptions\DomainException;
use App\Models\ActivationRequest;
use App\Models\MachineBinding;
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
 * The website verifies that the customer owns a paid order and a usable
 * licence, records the request with the Machine ID encrypted, and lets a
 * support user carry the safe vendor response back. Nothing here issues, signs
 * or stores a token or key: that happens in the offline vendor process, outside
 * this application.
 *
 * How many machines a licence may run on is decided here, not by the reviewer.
 * A licence's seats are its machine bindings: completing a request takes one,
 * deactivating gives it back, and a request that is still open holds one so
 * that ten requests filed at once cannot become ten activations. A reviewer can
 * still go past the limit deliberately, and that is recorded as an override.
 */
class ActivationService
{
    /** Requests that have not been settled yet still hold a seat. */
    private const OPEN_STATUSES = [
        ActivationRequestStatus::Submitted,
        ActivationRequestStatus::UnderReview,
        ActivationRequestStatus::Approved,
    ];

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

        $license = $this->usableLicense($user, $order, $input['license_code'] ?? null);
        $fingerprint = MachineIdentifier::fingerprint($machineId);

        return DB::transaction(function () use ($user, $order, $license, $machineId, $fingerprint, $input) {
            // Held while the seats are counted, so two requests sent at the same
            // moment cannot both find the last one free.
            $locked = SoftwareLicense::query()->lockForUpdate()->findOrFail($license->getKey());

            $duplicate = ActivationRequest::query()
                ->where('user_id', $user->getKey())
                ->where('machine_id_fingerprint', $fingerprint)
                ->whereIn('status', array_map(fn ($status) => $status->value, self::OPEN_STATUSES))
                ->exists();

            if ($duplicate) {
                throw DomainException::conflict('You already have an open request for this machine.');
            }

            if ($this->isBound($locked, $fingerprint)) {
                throw DomainException::conflict('This machine is already activated on this licence.');
            }

            $inUse = $this->seatsInUse($locked);

            if ($inUse >= $locked->device_limit) {
                throw DomainException::conflict(
                    "This licence is already in use on {$inUse} of {$locked->device_limit} machines. "
                        .'Deactivate one from Account → Licences, or ask support, before activating another.'
                );
            }

            $request = new ActivationRequest([
                'reference' => Reference::activation(),
                'user_id' => $user->getKey(),
                'order_id' => $order->getKey(),
                'software_license_id' => $locked->getKey(),
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
                'seats_in_use' => $inUse + 1,
                'device_limit' => $locked->device_limit,
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
        bool $overrideDeviceLimit = false,
    ): ActivationRequest {
        if (! $request->status->allows($to)) {
            throw DomainException::conflict(
                "Cannot move this request from {$request->status->value} to {$to->value}."
            );
        }

        return DB::transaction(function () use ($request, $to, $actor, $note, $vendorResponse, $overrideDeviceLimit) {
            $from = $request->status;

            // The machine is bound when the vendor process is finished and
            // released when it is deactivated, so the seat count is the truth
            // about which machines may run the software.
            $overridden = $to === ActivationRequestStatus::Completed
                ? $this->bindMachine($request, $actor, $overrideDeviceLimit)
                : false;

            if ($to === ActivationRequestStatus::Deactivated) {
                $this->releaseMachine($request, $actor);
            }

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
                'note' => $overridden ? trim(($note ?? '').' [device limit overridden]') : $note,
                'actor_id' => $actor->getKey(),
            ]);

            Audit::record('activation.status_changed', $request, [
                'from' => $from->value,
                'to' => $to->value,
                'device_limit_overridden' => $overridden,
            ], $actor->getKey());

            return $request->refresh();
        });
    }

    /**
     * How many machines the licence is currently counted as running on: every
     * machine bound to it, plus every machine with a request still open.
     */
    public function seatsInUse(SoftwareLicense $license): int
    {
        $bound = $license->machineBindings()
            ->whereNull('released_at')
            ->pluck('machine_id_fingerprint');

        $pending = ActivationRequest::query()
            ->where('software_license_id', $license->getKey())
            ->whereIn('status', array_map(fn ($status) => $status->value, self::OPEN_STATUSES))
            ->pluck('machine_id_fingerprint');

        return $bound->merge($pending)->filter()->unique()->count();
    }

    private function isBound(SoftwareLicense $license, string $fingerprint): bool
    {
        return $license->machineBindings()
            ->where('machine_id_fingerprint', $fingerprint)
            ->whereNull('released_at')
            ->exists();
    }

    /** Returns true when the reviewer went past the licence's device limit. */
    private function bindMachine(ActivationRequest $request, User $actor, bool $override): bool
    {
        /** @var SoftwareLicense|null $license */
        $license = $request->software_license_id
            ? SoftwareLicense::query()->lockForUpdate()->find($request->software_license_id)
            : null;

        if (! $license) {
            throw DomainException::conflict('This request has no licence to activate.');
        }

        /** @var MachineBinding|null $binding */
        $binding = $license->machineBindings()
            ->where('machine_id_fingerprint', $request->machine_id_fingerprint)
            ->first();

        if ($binding && $binding->released_at === null) {
            return false;
        }

        $inUse = $license->machineBindings()->whereNull('released_at')->count();
        $overridden = false;

        if ($inUse >= $license->device_limit) {
            if (! $override) {
                throw DomainException::conflict(
                    "This licence is already active on {$inUse} of {$license->device_limit} machines. "
                        .'Deactivate one first, or complete this with the device-limit override.'
                );
            }

            $overridden = true;
        }

        if ($binding) {
            $binding->update(['released_at' => null, 'bound_at' => now()]);
        } else {
            $binding = $license->machineBindings()->make([
                'bound_at' => now(),
                'label' => 'Activated by support',
            ]);
            $binding->setMachineId($request->machine_id_encrypted);
            $binding->save();
        }

        if ($overridden) {
            Audit::record('activation.device_limit_overridden', $request, [
                'license' => $license->license_code,
                'device_limit' => $license->device_limit,
                'machines_active' => $inUse + 1,
                'machine_id_masked' => $request->machine_id_masked,
            ], $actor->getKey());
        }

        return $overridden;
    }

    private function releaseMachine(ActivationRequest $request, User $actor): void
    {
        $released = MachineBinding::query()
            ->where('software_license_id', $request->software_license_id)
            ->where('machine_id_fingerprint', $request->machine_id_fingerprint)
            ->whereNull('released_at')
            ->update(['released_at' => now()]);

        if ($released > 0) {
            Audit::record('activation.machine_released', $request, [
                'machine_id_masked' => $request->machine_id_masked,
            ], $actor->getKey());
        }
    }

    /**
     * The licence this request is for, refused when there is none or when it
     * cannot be used: a course order carries no licence, and a revoked, expired
     * or refunded one activates nothing.
     */
    private function usableLicense(User $user, Order $order, ?string $licenseCode): SoftwareLicense
    {
        $query = SoftwareLicense::query()->where('user_id', $user->getKey());

        $license = $licenseCode
            ? (clone $query)->where('license_code', $licenseCode)->first()
            : (clone $query)->where('order_id', $order->getKey())->first();

        if (! $license) {
            throw new DomainException($licenseCode
                ? 'That licence code is not on your account.'
                : 'This order has no software licence to activate. Open the order that included the software.');
        }

        if ($license->revoked_at || ! $license->status->isUsable()) {
            throw new DomainException('This licence is no longer active. Contact support.');
        }

        if ($license->expires_at && $license->expires_at->isPast()) {
            throw new DomainException('This licence has expired. Renew it before activating a machine.');
        }

        if (! $license->order || ! $license->order->status->grantsEntitlements()) {
            throw new DomainException('The order behind this licence is no longer paid.');
        }

        return $license;
    }
}
