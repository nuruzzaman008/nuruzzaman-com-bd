<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\ProductType;
use App\Models\Course;
use App\Models\DownloadAsset;
use App\Models\Enrollment;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Price;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SoftwareLicense;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FulfillmentTest extends TestCase
{
    use RefreshDatabase;

    private function paidOrderFor(ProductVariant $variant, User $user): Order
    {
        $order = Order::factory()->for($user)->paid()->create();

        $order->items()->create([
            'product_variant_id' => $variant->getKey(),
            'product_type' => $variant->product->type->value,
            'product_name' => $variant->product->name,
            'variant_name' => $variant->name,
            'sku' => $variant->sku,
            'quantity' => 1,
            'unit_price_minor' => 500000,
            'line_total_minor' => 500000,
            'fulfillment_meta' => [
                'course_id' => $variant->course_id,
                'device_limit' => $variant->device_limit,
                'license_term_days' => $variant->license_term_days,
                'access_duration_days' => $variant->access_duration_days,
            ],
        ]);

        return $order->fresh(['items.variant.product', 'user']);
    }

    public function test_a_paid_course_order_creates_an_enrollment_and_an_invoice(): void
    {
        $user = $this->customer();
        $course = Course::factory()->published()->create();
        $product = Product::factory()->ofType(ProductType::Course)->create();
        $variant = ProductVariant::factory()->for($product)->create(['course_id' => $course->id]);
        Price::factory()->for($variant, 'variant')->create();

        $order = $this->paidOrderFor($variant, $user);
        app(FulfillmentService::class)->fulfill($order);

        $this->assertDatabaseHas('enrollments', [
            'user_id' => $user->id,
            'course_id' => $course->id,
            'status' => 'active',
        ]);
        $this->assertSame(1, Invoice::query()->count());
        $this->assertSame(OrderStatus::Fulfilled, $order->fresh()->status);
    }

    public function test_a_software_order_issues_a_licence_and_a_download_entitlement(): void
    {
        $user = $this->customer();
        $product = Product::factory()->ofType(ProductType::SoftwareLicense)->create();
        $variant = ProductVariant::factory()->for($product)->create(['device_limit' => 1]);
        $asset = DownloadAsset::create([
            'slug' => 'installer',
            'name' => 'Installer',
            'disk' => 'private',
            'storage_path' => 'releases/installer.exe',
            'is_available' => true,
        ]);
        $variant->downloadAssets()->attach($asset, ['max_downloads' => 5, 'valid_days' => 365]);

        $order = $this->paidOrderFor($variant, $user);
        app(FulfillmentService::class)->fulfill($order);

        $this->assertDatabaseHas('software_licenses', ['user_id' => $user->id, 'status' => 'issued']);
        $this->assertDatabaseHas('download_entitlements', [
            'user_id' => $user->id,
            'download_asset_id' => $asset->id,
            'max_downloads' => 5,
        ]);
    }

    public function test_fulfilment_is_safe_to_run_twice(): void
    {
        $user = $this->customer();
        $course = Course::factory()->published()->create();
        $product = Product::factory()->ofType(ProductType::Course)->create();
        $variant = ProductVariant::factory()->for($product)->create(['course_id' => $course->id]);

        $order = $this->paidOrderFor($variant, $user);

        app(FulfillmentService::class)->fulfill($order);
        app(FulfillmentService::class)->fulfill($order->fresh(['items.variant.product', 'user']));

        $this->assertSame(1, Enrollment::query()->count());
        $this->assertSame(1, Invoice::query()->count());
        // A course order issues no software licence.
        $this->assertSame(0, SoftwareLicense::query()->count());
    }

    public function test_an_unpaid_order_is_never_fulfilled(): void
    {
        $user = $this->customer();
        $course = Course::factory()->published()->create();
        $product = Product::factory()->ofType(ProductType::Course)->create();
        $variant = ProductVariant::factory()->for($product)->create(['course_id' => $course->id]);

        $order = Order::factory()->for($user)->create(['status' => OrderStatus::PendingPayment]);
        $order->items()->create([
            'product_variant_id' => $variant->getKey(),
            'product_type' => ProductType::Course->value,
            'product_name' => $product->name,
            'variant_name' => $variant->name,
            'sku' => $variant->sku,
            'quantity' => 1,
            'unit_price_minor' => 500000,
            'line_total_minor' => 500000,
        ]);

        app(FulfillmentService::class)->fulfill($order->fresh(['items.variant.product', 'user']));

        $this->assertSame(0, Enrollment::query()->count());
        $this->assertSame(0, Invoice::query()->count());
    }
}
