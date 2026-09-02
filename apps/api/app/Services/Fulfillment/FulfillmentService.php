<?php

namespace App\Services\Fulfillment;

use App\Enums\LicenseStatus;
use App\Enums\OrderStatus;
use App\Enums\ProductType;
use App\Enums\RefillOrderStatus;
use App\Models\Course;
use App\Models\DownloadEntitlement;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductVariant;
use App\Models\RefillOrder;
use App\Models\SoftwareLicense;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Lms\EnrollmentService;
use App\Support\Audit;
use App\Support\Reference;
use Illuminate\Support\Facades\DB;

/**
 * Grants everything a paid order entitles the customer to. Written to be safe
 * to run more than once: every grant is an upsert keyed on the order item.
 */
class FulfillmentService
{
    public function __construct(
        private readonly EnrollmentService $enrollments,
        private readonly OrderStateMachine $states,
    ) {}

    public function fulfill(Order $order): Order
    {
        if (! $order->status->grantsEntitlements()) {
            return $order;
        }

        $order->loadMissing(['items.variant.downloadAssets', 'items.variant.bundledVariants', 'user']);

        DB::transaction(function () use ($order) {
            foreach ($order->items as $item) {
                $this->fulfillItem($order, $item);
            }

            $this->issueInvoice($order);
        });

        Audit::record('order.fulfilled', $order, ['items' => $order->items->count()]);

        return $order->status->allows(OrderStatus::Fulfilled)
            ? $this->states->transition($order, OrderStatus::Fulfilled, 'Entitlements granted')
            : $order->refresh();
    }

    private function fulfillItem(Order $order, OrderItem $item): void
    {
        $type = ProductType::tryFrom($item->product_type);
        $variant = $item->variant;

        if ($type?->grantsEnrollment() && $variant) {
            $this->grantCourses($order, $item, $variant);
        }

        if ($type?->grantsDownload() && $variant) {
            $this->grantDownloads($order, $item, $variant);
        }

        if ($type === ProductType::SoftwareLicense) {
            $this->issueLicense($order, $item);
        }

        if ($type === ProductType::CreditRefill) {
            $this->requestRefill($order, $item);
        }
    }

    private function grantCourses(Order $order, OrderItem $item, ProductVariant $variant): void
    {
        foreach ($this->variantsInside($variant) as $inner) {
            if (! $inner->course_id) {
                continue;
            }

            $course = Course::find($inner->course_id);

            if ($course) {
                $this->enrollments->enroll($order->user, $course, $item);
            }
        }
    }

    private function grantDownloads(Order $order, OrderItem $item, ProductVariant $variant): void
    {
        foreach ($this->variantsInside($variant) as $inner) {
            foreach ($inner->downloadAssets as $asset) {
                $maxDownloads = $asset->pivot->max_downloads ?? config('nb.downloads.default_max_downloads');
                $validDays = $asset->pivot->valid_days ?? config('nb.downloads.default_valid_days');

                DownloadEntitlement::query()->updateOrCreate(
                    [
                        'user_id' => $order->user_id,
                        'download_asset_id' => $asset->getKey(),
                        'order_id' => $order->getKey(),
                    ],
                    [
                        'order_item_id' => $item->getKey(),
                        'max_downloads' => $maxDownloads,
                        'expires_at' => $validDays ? now()->addDays((int) $validDays) : null,
                        'revoked_at' => null,
                        'revoked_reason' => null,
                    ],
                );
            }
        }
    }

    private function issueLicense(Order $order, OrderItem $item): void
    {
        $meta = $item->fulfillment_meta ?? [];
        $termDays = $meta['license_term_days'] ?? null;

        SoftwareLicense::query()->firstOrCreate(
            ['order_item_id' => $item->getKey()],
            [
                'license_code' => Reference::license(),
                'user_id' => $order->user_id,
                'order_id' => $order->getKey(),
                'product_name' => $item->product_name,
                'status' => LicenseStatus::Issued,
                'device_limit' => $meta['device_limit'] ?? 1,
                'issued_at' => now(),
                'expires_at' => $termDays ? now()->addDays((int) $termDays) : null,
            ],
        );
    }

    private function requestRefill(Order $order, OrderItem $item): void
    {
        $amount = (int) ($item->fulfillment_meta['credit_amount'] ?? 0);

        if ($amount <= 0) {
            return;
        }

        RefillOrder::query()->firstOrCreate(
            ['order_id' => $order->getKey(), 'credit_amount' => $amount * $item->quantity],
            [
                'reference' => Reference::refill(),
                'user_id' => $order->user_id,
                'status' => RefillOrderStatus::Requested,
            ],
        );
    }

    private function issueInvoice(Order $order): void
    {
        Invoice::query()->firstOrCreate(
            ['order_id' => $order->getKey()],
            [
                'number' => Reference::invoice(),
                'currency' => $order->currency,
                'total_minor' => $order->total_minor,
                'snapshot' => [
                    'order_number' => $order->number,
                    'billed_to' => $order->billing_name,
                    'email' => $order->billing_email,
                    'items' => $order->items->map(fn (OrderItem $item) => [
                        'name' => $item->product_name.' - '.$item->variant_name,
                        'sku' => $item->sku,
                        'quantity' => $item->quantity,
                        'unit_price_minor' => $item->unit_price_minor,
                        'line_total_minor' => $item->line_total_minor,
                    ])->all(),
                    'subtotal_minor' => $order->subtotal_minor,
                    'discount_minor' => $order->discount_minor,
                    'tax_minor' => $order->tax_minor,
                    'total_minor' => $order->total_minor,
                ],
                'issued_at' => now(),
            ],
        );
    }

    /** A bundle fulfils everything inside it; a plain variant fulfils itself. */
    private function variantsInside(ProductVariant $variant): iterable
    {
        $variant->loadMissing(['bundledVariants.downloadAssets', 'downloadAssets']);

        return $variant->bundledVariants->isNotEmpty()
            ? $variant->bundledVariants
            : collect([$variant]);
    }
}
