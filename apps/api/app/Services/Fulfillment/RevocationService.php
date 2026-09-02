<?php

namespace App\Services\Fulfillment;

use App\Enums\LicenseStatus;
use App\Models\Order;
use App\Services\Lms\EnrollmentService;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

/**
 * The refund counterpart of FulfillmentService. Whether a refund revokes access
 * is a per-refund decision recorded on the refund row, not a silent default.
 */
class RevocationService
{
    public function __construct(private readonly EnrollmentService $enrollments) {}

    public function revokeForOrder(Order $order, string $reason): void
    {
        DB::transaction(function () use ($order, $reason) {
            $order->user->downloadEntitlements()
                ->where('order_id', $order->getKey())
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now(), 'revoked_reason' => $reason]);

            foreach ($order->user->enrollments()->where('order_id', $order->getKey())->get() as $enrollment) {
                $this->enrollments->revoke($enrollment, $reason);
            }

            $order->user->softwareLicenses()
                ->where('order_id', $order->getKey())
                ->update([
                    'status' => LicenseStatus::Revoked->value,
                    'revoked_at' => now(),
                    'revoked_reason' => $reason,
                ]);
        });

        Audit::record('order.entitlements_revoked', $order, ['reason' => $reason]);
    }
}
