<?php

namespace Tests\Feature;

use App\Enums\ActivationRequestStatus;
use App\Enums\LicenseStatus;
use App\Enums\OrderStatus;
use App\Enums\ProductType;
use App\Enums\Role as RoleEnum;
use App\Models\ActivationRequest;
use App\Models\Course;
use App\Models\MachineBinding;
use App\Models\Order;
use App\Models\Price;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SoftwareLicense;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentService;
use App\Support\Reference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * How many machines one licence may run on is decided by the server, not by the
 * reviewer who approves the request. Hardening pass of 21 September 2026.
 */
class LicenseActivationTest extends TestCase
{
    use RefreshDatabase;

    private const MACHINE_A = 'AAAA-1111-BBBB-2222';

    private const MACHINE_B = 'CCCC-3333-DDDD-4444';

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    /** A paid software order, fulfilled, so the customer holds a real licence. */
    private function licensedCustomer(int $deviceLimit = 1): array
    {
        $user = $this->customer();
        $product = Product::factory()->ofType(ProductType::SoftwareLicense)->create();
        $variant = ProductVariant::factory()->for($product)->create(['device_limit' => $deviceLimit]);
        Price::factory()->for($variant, 'variant')->create();

        $order = Order::factory()->for($user)->paid()->create();
        $order->items()->create([
            'product_variant_id' => $variant->getKey(),
            'product_type' => ProductType::SoftwareLicense->value,
            'product_name' => $product->name,
            'variant_name' => $variant->name,
            'sku' => $variant->sku,
            'quantity' => 1,
            'unit_price_minor' => 500000,
            'line_total_minor' => 500000,
            'fulfillment_meta' => ['device_limit' => $deviceLimit],
        ]);

        app(FulfillmentService::class)->fulfill($order->fresh(['items.variant.product', 'user']));

        return [$user, $order->fresh(), SoftwareLicense::query()->where('user_id', $user->id)->firstOrFail()];
    }

    private function submit(User $user, Order $order, string $machineId): TestResponse
    {
        return $this->actingAs($user)->postJson('/api/v1/account/activation-requests', [
            'order_number' => $order->number,
            'machine_id' => $machineId,
        ]);
    }

    /** Takes a submitted request all the way to a bound machine. */
    private function complete(string $reference, array $overrides = []): TestResponse
    {
        $admin = $this->userWithRole(RoleEnum::Admin);
        $url = '/api/v1/admin/activation-requests/'.$reference.'/transition';

        $this->actingAs($admin)->postJson($url, ['status' => 'under_review'])->assertOk();
        $this->actingAs($admin)->postJson($url, ['status' => 'approved'])->assertOk();

        return $this->actingAs($admin)->postJson($url, ['status' => 'completed'] + $overrides);
    }

    private function reference(): string
    {
        return ActivationRequest::query()->latest('id')->firstOrFail()->reference;
    }

    public function test_a_first_activation_binds_the_machine_to_the_licence(): void
    {
        [$user, $order, $license] = $this->licensedCustomer();

        $this->submit($user, $order, self::MACHINE_A)
            ->assertCreated()
            ->assertJsonPath('data.status', 'submitted');

        $this->complete($this->reference())->assertOk()->assertJsonPath('data.status', 'completed');

        $this->assertSame(1, $license->machineBindings()->whereNull('released_at')->count());
        // The Machine ID is never stored or returned in the clear.
        $binding = $license->machineBindings()->firstOrFail();
        $this->assertStringContainsString('*', $binding->machine_id_masked);
        $this->assertNotSame(self::MACHINE_A, $binding->getRawOriginal('machine_id_encrypted'));
    }

    public function test_a_second_machine_is_refused_once_the_device_limit_is_reached(): void
    {
        [$user, $order] = $this->licensedCustomer(deviceLimit: 1);

        $this->submit($user, $order, self::MACHINE_A)->assertCreated();
        $this->complete($this->reference())->assertOk();

        $this->submit($user, $order, self::MACHINE_B)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'conflict');

        $this->assertSame(1, ActivationRequest::query()->count());
    }

    public function test_open_requests_hold_a_seat_so_the_limit_cannot_be_flooded(): void
    {
        [$user, $order] = $this->licensedCustomer(deviceLimit: 1);

        // Nothing is approved yet, but the first request already holds the seat.
        $this->submit($user, $order, self::MACHINE_A)->assertCreated();
        $this->submit($user, $order, self::MACHINE_B)->assertStatus(409);

        $this->assertSame(1, ActivationRequest::query()->count());
    }

    public function test_the_same_machine_cannot_be_activated_twice(): void
    {
        [$user, $order] = $this->licensedCustomer(deviceLimit: 3);

        $this->submit($user, $order, self::MACHINE_A)->assertCreated();
        // While the first request is open.
        $this->submit($user, $order, self::MACHINE_A)->assertStatus(409);

        $this->complete($this->reference())->assertOk();
        // And once it is activated: the same machine, written differently.
        $this->submit($user, $order, strtolower(str_replace('-', ' ', self::MACHINE_A)))->assertStatus(409);

        $this->assertSame(1, MachineBinding::query()->count());
    }

    public function test_deactivating_frees_the_seat_and_the_machine_can_be_activated_again(): void
    {
        [$user, $order, $license] = $this->licensedCustomer(deviceLimit: 1);
        $admin = $this->userWithRole(RoleEnum::Admin);

        $this->submit($user, $order, self::MACHINE_A)->assertCreated();
        $first = $this->reference();
        $this->complete($first)->assertOk();

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/activation-requests/'.$first.'/transition', ['status' => 'deactivated'])
            ->assertOk()
            ->assertJsonPath('data.status', 'deactivated');

        $this->assertSame(0, $license->machineBindings()->whereNull('released_at')->count());

        // The freed seat is available to another machine.
        $this->submit($user, $order, self::MACHINE_B)->assertCreated();
        $this->complete($this->reference())->assertOk();
        $this->assertSame(1, $license->machineBindings()->whereNull('released_at')->count());

        // Reactivating the first machine now needs a seat, and there is none.
        $this->actingAs($admin)
            ->postJson('/api/v1/admin/activation-requests/'.$first.'/transition', ['status' => 'completed'])
            ->assertStatus(409);

        // Free the second machine, and the first can come back.
        $this->actingAs($admin)
            ->postJson('/api/v1/admin/activation-requests/'.$this->reference().'/transition', ['status' => 'deactivated'])
            ->assertOk();
        $this->actingAs($admin)
            ->postJson('/api/v1/admin/activation-requests/'.$first.'/transition', ['status' => 'completed'])
            ->assertOk();

        $this->assertSame(1, $license->machineBindings()->whereNull('released_at')->count());
        $this->assertSame(2, MachineBinding::query()->count());
    }

    public function test_an_order_without_a_licence_cannot_activate_anything(): void
    {
        $user = $this->customer();
        $course = Course::factory()->published()->create();
        $product = Product::factory()->ofType(ProductType::Course)->create();
        $variant = ProductVariant::factory()->for($product)->create(['course_id' => $course->id]);
        Price::factory()->for($variant, 'variant')->create();

        $order = Order::factory()->for($user)->paid()->create();
        $order->items()->create([
            'product_variant_id' => $variant->getKey(),
            'product_type' => ProductType::Course->value,
            'product_name' => $product->name,
            'variant_name' => $variant->name,
            'sku' => $variant->sku,
            'quantity' => 1,
            'unit_price_minor' => 500000,
            'line_total_minor' => 500000,
            'fulfillment_meta' => ['course_id' => $course->id],
        ]);

        $this->submit($user, $order->fresh(), self::MACHINE_A)->assertStatus(422);
        $this->assertSame(0, ActivationRequest::query()->count());
    }

    public function test_another_customers_order_and_licence_are_refused(): void
    {
        [, $order] = $this->licensedCustomer();
        [$neighbour, $neighbourOrder, $neighbourLicense] = $this->licensedCustomer();

        // Someone else's order.
        $this->submit($neighbour, $order, self::MACHINE_A)->assertStatus(403);

        // Their own order, but a licence code that is not theirs.
        $stranger = SoftwareLicense::query()->where('user_id', '!=', $neighbour->id)->firstOrFail();
        $this->actingAs($neighbour)->postJson('/api/v1/account/activation-requests', [
            'order_number' => $neighbourOrder->number,
            'license_code' => $stranger->license_code,
            'machine_id' => self::MACHINE_A,
        ])->assertStatus(422);

        // A revoked licence activates nothing.
        $neighbourLicense->update(['status' => LicenseStatus::Revoked, 'revoked_at' => now()]);
        $this->submit($neighbour, $neighbourOrder, self::MACHINE_B)->assertStatus(422);

        // Nor does one whose order was refunded.
        $neighbourLicense->update(['status' => LicenseStatus::Issued, 'revoked_at' => null]);
        $neighbourOrder->update(['status' => OrderStatus::Refunded]);
        $this->submit($neighbour, $neighbourOrder->fresh(), self::MACHINE_B)->assertStatus(422);

        $this->assertSame(0, ActivationRequest::query()->count());
    }

    public function test_activation_needs_a_signed_in_customer(): void
    {
        [, $order] = $this->licensedCustomer();

        $this->postJson('/api/v1/account/activation-requests', [
            'order_number' => $order->number,
            'machine_id' => self::MACHINE_A,
        ])->assertStatus(401);
    }

    public function test_a_reviewer_can_go_past_the_limit_deliberately_and_it_is_recorded(): void
    {
        [$user, $order, $license] = $this->licensedCustomer(deviceLimit: 1);

        $this->submit($user, $order, self::MACHINE_A)->assertCreated();
        $this->complete($this->reference())->assertOk();

        // The customer cannot file the second one, so support files it for them:
        // a request created directly, as the review screen allows.
        $second = new ActivationRequest([
            'reference' => Reference::activation(),
            'user_id' => $user->id,
            'order_id' => $order->id,
            'software_license_id' => $license->id,
            'status' => ActivationRequestStatus::Approved,
            'request_type' => 'activation',
        ]);
        $second->setMachineId(self::MACHINE_B);
        $second->save();

        $admin = $this->userWithRole(RoleEnum::Admin);
        $url = '/api/v1/admin/activation-requests/'.$second->reference.'/transition';

        // Without the override it is refused, even for an administrator.
        $this->actingAs($admin)->postJson($url, ['status' => 'completed'])->assertStatus(409);

        $this->actingAs($admin)
            ->postJson($url, ['status' => 'completed', 'override_device_limit' => true])
            ->assertOk();

        $this->assertSame(2, $license->machineBindings()->whereNull('released_at')->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'activation.device_limit_overridden']);
    }

    public function test_support_staff_cannot_review_without_the_permission(): void
    {
        [$user, $order] = $this->licensedCustomer();
        $this->submit($user, $order, self::MACHINE_A)->assertCreated();

        $this->actingAs($user)
            ->postJson('/api/v1/admin/activation-requests/'.$this->reference().'/transition', ['status' => 'under_review'])
            ->assertStatus(403);
    }
}
