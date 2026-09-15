<?php

namespace App\Services\Affiliates;

use App\Enums\OrderStatus;
use App\Exceptions\DomainException;
use App\Models\Affiliate;
use App\Models\AffiliateCommission;
use App\Models\AffiliatePayout;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The money side of the affiliate program: the commission a referred order
 * earns, what a refund does to it, and the balance still owed.
 *
 * Payouts are subtracted from the balance rather than marking commissions
 * paid, so a commission voided after it was paid out simply leaves a
 * negative balance that later earnings make up.
 */
class AffiliateLedger
{
    public function __construct(private readonly AffiliateProgram $program) {}

    /** Called by the order state machine on every status change. */
    public function orderMovedTo(Order $order, OrderStatus $status): void
    {
        if ($order->affiliate_id === null) {
            return;
        }

        match ($status) {
            OrderStatus::Paid, OrderStatus::Fulfilled => $this->earn($order),
            OrderStatus::PartiallyRefunded => $this->reprice($order),
            OrderStatus::Refunded => $this->voidForOrder($order, 'Order refunded'),
            default => null,
        };
    }

    public function voidCommission(AffiliateCommission $commission, string $reason, ?User $actor = null): AffiliateCommission
    {
        if ($commission->status === AffiliateCommission::STATUS_VOID) {
            return $commission;
        }

        $commission->update([
            'status' => AffiliateCommission::STATUS_VOID,
            'voided_at' => now(),
            'void_reason' => Str::limit($reason, 250, ''),
        ]);

        Audit::record('affiliate.commission_voided', $commission, [
            'order_id' => $commission->order_id,
            'amount_minor' => $commission->amount_minor,
            'reason' => $reason,
        ], $actor?->getKey());

        return $commission;
    }

    /** @return array{visits: int, orders: int, earned_minor: int, pending_minor: int, available_minor: int, paid_minor: int, balance_minor: int} */
    public function summary(Affiliate $affiliate): array
    {
        $earned = fn () => AffiliateCommission::query()
            ->where('affiliate_id', $affiliate->getKey())
            ->where('status', AffiliateCommission::STATUS_EARNED);

        return $this->figures(
            visits: $affiliate->visits()->count(),
            orders: $earned()->count(),
            earned: (int) $earned()->sum('amount_minor'),
            available: (int) $earned()->where('available_at', '<=', now())->sum('amount_minor'),
            paid: (int) AffiliatePayout::query()->where('affiliate_id', $affiliate->getKey())->sum('amount_minor'),
        );
    }

    /** Loads what summaryFromAggregates() reads, in one query for a whole list. */
    public function withAggregates(Builder $query): Builder
    {
        $earned = fn ($commissions) => $commissions->where('status', AffiliateCommission::STATUS_EARNED);

        return $query
            ->withCount('visits')
            ->withCount(['commissions as orders_count' => $earned])
            ->withSum(['commissions as earned_minor' => $earned], 'amount_minor')
            ->withSum(['commissions as available_minor' => fn ($commissions) => $earned($commissions)
                ->where('available_at', '<=', now())], 'amount_minor')
            ->withSum('payouts as paid_minor', 'amount_minor');
    }

    public function summaryFromAggregates(Affiliate $affiliate): array
    {
        return $this->figures(
            visits: (int) $affiliate->visits_count,
            orders: (int) $affiliate->orders_count,
            earned: (int) $affiliate->earned_minor,
            available: (int) $affiliate->available_minor,
            paid: (int) $affiliate->paid_minor,
        );
    }

    /** @return array{pending_minor: int, balance_minor: int, paid_minor: int} */
    public function programTotals(): array
    {
        $earned = AffiliateCommission::query()->where('status', AffiliateCommission::STATUS_EARNED);
        $available = (int) (clone $earned)->where('available_at', '<=', now())->sum('amount_minor');
        $paid = (int) AffiliatePayout::query()->sum('amount_minor');

        return [
            'pending_minor' => (int) (clone $earned)->where('available_at', '>', now())->sum('amount_minor'),
            'balance_minor' => $available - $paid,
            'paid_minor' => $paid,
        ];
    }

    /**
     * Records money the owner has already sent. It can never be more than the
     * balance available, so the two sides cannot drift apart.
     *
     * @param  array{amount_minor: int, method: string, reference?: ?string, note?: ?string, paid_at?: ?string}  $data
     */
    public function recordPayout(Affiliate $affiliate, array $data, User $actor): AffiliatePayout
    {
        return DB::transaction(function () use ($affiliate, $data, $actor) {
            // Two admins paying the same balance at once must not both succeed.
            Affiliate::query()->lockForUpdate()->findOrFail($affiliate->getKey());

            $balance = $this->summary($affiliate)['balance_minor'];

            if ($data['amount_minor'] > $balance) {
                throw new DomainException(sprintf(
                    'The payout is more than the balance available to pay (BDT %s).',
                    number_format(max(0, $balance) / 100, 2),
                ));
            }

            $payout = AffiliatePayout::create([
                'affiliate_id' => $affiliate->getKey(),
                'amount_minor' => $data['amount_minor'],
                'currency' => 'BDT',
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'note' => $data['note'] ?? null,
                'paid_at' => $data['paid_at'] ?? now(),
                'recorded_by' => $actor->getKey(),
            ]);

            Audit::record('affiliate.payout_recorded', $payout, [
                'affiliate' => $affiliate->code,
                'amount_minor' => $payout->amount_minor,
                'method' => $payout->method,
            ], $actor->getKey());

            return $payout;
        });
    }

    /** A commission as the affiliate sees it: what was bought, never who bought it. */
    public function commissionRow(AffiliateCommission $commission, bool $forStaff = false): array
    {
        $order = $commission->order;

        $row = [
            'id' => $commission->id,
            'state' => $commission->state(),
            'currency' => $commission->currency,
            'base_minor' => $commission->base_minor,
            'rate' => (float) $commission->rate,
            'amount_minor' => $commission->amount_minor,
            'items' => $order?->items->map(fn (OrderItem $item) => $item->variant_name && $item->variant_name !== $item->product_name
                ? $item->product_name.' — '.$item->variant_name
                : $item->product_name)->values()->all() ?? [],
            'created_at' => $commission->created_at?->toIso8601String(),
            'available_at' => $commission->available_at?->toIso8601String(),
            'void_reason' => $commission->void_reason,
        ];

        if ($forStaff) {
            $row += [
                'order_number' => $order?->number,
                'order_status' => $order?->status?->value,
                'buyer_name' => $order?->billing_name,
                'buyer_email' => $order?->billing_email,
            ];
        }

        return $row;
    }

    public function payoutRow(AffiliatePayout $payout, bool $forStaff = false): array
    {
        $row = [
            'id' => $payout->id,
            'amount_minor' => $payout->amount_minor,
            'currency' => $payout->currency,
            'method' => $payout->method,
            'reference' => $payout->reference,
            'note' => $payout->note,
            'paid_at' => $payout->paid_at?->toIso8601String(),
        ];

        if ($forStaff) {
            $row['recorded_by'] = $payout->recorder?->name;
        }

        return $row;
    }

    private function earn(Order $order): void
    {
        if (AffiliateCommission::query()->where('order_id', $order->getKey())->exists()) {
            return;
        }

        $affiliate = Affiliate::query()->find($order->affiliate_id);

        // Suspended since the visit: the order stays attributed but earns nothing.
        if (! $affiliate || ! $affiliate->isActive() || (int) $affiliate->user_id === (int) $order->user_id) {
            return;
        }

        $base = $this->baseFor($order);

        if ($base <= 0) {
            return;
        }

        $settings = $this->program->settings();
        $rate = $this->program->rateFor($affiliate, $settings['default_rate']);

        $commission = AffiliateCommission::create([
            'affiliate_id' => $affiliate->getKey(),
            'order_id' => $order->getKey(),
            'currency' => $order->currency,
            'base_minor' => $base,
            'rate' => $rate,
            'amount_minor' => $this->percentOf($base, $rate),
            'status' => AffiliateCommission::STATUS_EARNED,
            'available_at' => now()->addDays($settings['hold_days']),
        ]);

        Audit::record('affiliate.commission_earned', $commission, [
            'affiliate' => $affiliate->code,
            'order' => $order->number,
            'amount_minor' => $commission->amount_minor,
        ]);
    }

    private function reprice(Order $order): void
    {
        $commission = $this->earnedFor($order);

        if (! $commission) {
            return;
        }

        $base = $this->baseFor($order);
        $before = $commission->amount_minor;

        $commission->update([
            'base_minor' => $base,
            'amount_minor' => $this->percentOf($base, (float) $commission->rate),
        ]);

        Audit::record('affiliate.commission_repriced', $commission, [
            'order' => $order->number,
            'from_minor' => $before,
            'to_minor' => $commission->amount_minor,
        ]);
    }

    private function voidForOrder(Order $order, string $reason): void
    {
        $commission = $this->earnedFor($order);

        if ($commission) {
            $this->voidCommission($commission, $reason);
        }
    }

    private function earnedFor(Order $order): ?AffiliateCommission
    {
        return AffiliateCommission::query()
            ->where('order_id', $order->getKey())
            ->where('status', AffiliateCommission::STATUS_EARNED)
            ->first();
    }

    /** What the customer paid for the goods: after discounts, before tax, less refunds. */
    private function baseFor(Order $order): int
    {
        return max(0, (int) $order->total_minor - (int) $order->tax_minor - (int) $order->refunded_minor);
    }

    /** Rounded down to the poisha, so the site never owes more than the rate says. */
    private function percentOf(int $minor, float $rate): int
    {
        return intdiv($minor * (int) round($rate * 100), 10000);
    }

    /** @return array{visits: int, orders: int, earned_minor: int, pending_minor: int, available_minor: int, paid_minor: int, balance_minor: int} */
    private function figures(int $visits, int $orders, int $earned, int $available, int $paid): array
    {
        return [
            'visits' => $visits,
            'orders' => $orders,
            'earned_minor' => $earned,
            'pending_minor' => $earned - $available,
            'available_minor' => $available,
            'paid_minor' => $paid,
            'balance_minor' => $available - $paid,
        ];
    }
}
