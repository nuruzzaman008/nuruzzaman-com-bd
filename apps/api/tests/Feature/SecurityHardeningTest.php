<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Exceptions\DomainException;
use App\Models\Order;
use App\Models\Payment;
use App\Services\Payments\FakeGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Fixes from the security audit of 17 September 2026. Each test pins one of
 * them so a later change cannot quietly undo it.
 */
class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    /** H1: a visitor cannot choose the address the rate limits and audit log see. */
    public function test_a_forwarded_address_is_believed_only_from_a_trusted_proxy(): void
    {
        Route::get('/_security/ip', fn (Request $request) => response()->json(['ip' => $request->ip()]));
        config(['trustedproxy.proxies' => '10.0.0.5']);

        // Straight from the internet: the header is the visitor's own claim.
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.9'])
            ->getJson('/_security/ip', ['X-Forwarded-For' => '203.0.113.7'])
            ->assertJsonPath('ip', '198.51.100.9');

        // Through this server's own proxy: the header carries the real visitor.
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.5'])
            ->getJson('/_security/ip', ['X-Forwarded-For' => '203.0.113.7'])
            ->assertJsonPath('ip', '203.0.113.7');
    }

    public function test_the_default_trusts_only_loopback(): void
    {
        // TRUSTED_PROXIES is not set under test, so this is the shipped default.
        $this->assertSame('127.0.0.1,::1', config('trustedproxy.proxies'));
    }

    /** H2: in production the sandbox gateway can neither start nor settle a payment. */
    public function test_the_sandbox_settles_nothing_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->get('/api/v1/payments/sandbox/PAY-ANYTHING?outcome=success')->assertNotFound();

        $payment = new Payment(['reference' => 'PAY-1', 'amount_minor' => 500000, 'currency' => 'BDT']);
        $validation = (new FakeGateway)->validateTransaction($payment, [
            'tran_id' => 'PAY-1',
            'val_id' => 'forged',
            'status' => 'VALID',
            'amount' => '5000.00',
            'currency' => 'BDT',
        ]);
        $this->assertFalse($validation->isValid);

        $this->expectException(DomainException::class);
        (new FakeGateway)->createSession(new Order, $payment);
    }

    public function test_the_sandbox_still_works_where_it_belongs(): void
    {
        $this->assertFalse($this->app->isProduction());

        $payment = new Payment(['reference' => 'PAY-2', 'amount_minor' => 1000, 'currency' => 'BDT']);
        $session = (new FakeGateway)->createSession(new Order, $payment);

        $this->assertStringContainsString('/api/v1/payments/sandbox/PAY-2', $session->redirectUrl);
    }

    /** M1: an SVG, which can carry a script, is not accepted into the media library. */
    public function test_an_svg_is_refused_by_the_media_library(): void
    {
        Storage::fake('public');
        $this->actingAs($this->userWithRole(Role::Admin));

        $svg = UploadedFile::fake()->createWithContent(
            'logo.svg',
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>',
        );

        $this->postJson('/api/v1/admin/media', ['file' => $svg, 'alt_text' => 'Logo'])->assertStatus(422);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }
}
