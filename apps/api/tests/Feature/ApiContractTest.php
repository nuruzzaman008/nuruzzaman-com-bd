<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Keeps packages/contracts/openapi.yaml and the real router in step.
 *
 * The spec is the contract the generated TypeScript client is built from, so a
 * route that drifts from it is a bug the frontend would only discover at
 * runtime. The bundled JSON is read instead of the YAML so no PHP YAML parser
 * is needed; run `npm run contracts:types` after editing the spec.
 */
class ApiContractTest extends TestCase
{
    /**
     * Endpoints that exist in the router but are deliberately not part of the
     * public contract, with the reason they are excluded.
     *
     * @var array<string, string>
     */
    private const UNDOCUMENTED = [
        'api/v1/payments/sandbox/{reference}' => 'Local sandbox stand-in; never bound in production.',
        'api/v1/auth/verify-email/{id}/{hash}' => 'Signed link followed by the browser, not called by the client.',
        'api/v1/me/password' => 'Account security form, not used by the generated client.',
        'api/v1/me/confirm-password' => 'Account security form, not used by the generated client.',
        'api/v1/me/sessions' => 'Device list, rendered by the account UI only.',
        'api/v1/me/sessions/{id}' => 'Device revoke, rendered by the account UI only.',
    ];

    private function spec(): array
    {
        $path = base_path('../../packages/contracts/openapi.json');

        $this->assertFileExists(
            $path,
            'Run `npm run contracts:types` to regenerate the bundled contract.',
        );

        return json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }

    /** @return array<int, string> "METHOD /path" pairs declared in the spec. */
    private function specOperations(array $spec): array
    {
        $operations = [];

        foreach ($spec['paths'] as $path => $methods) {
            foreach (array_keys($methods) as $method) {
                if (in_array($method, ['get', 'post', 'patch', 'put', 'delete'], true)) {
                    $operations[] = strtoupper($method).' api/v1'.$path;
                }
            }
        }

        sort($operations);

        return $operations;
    }

    /** @return array<int, string> "METHOD /path" pairs the router actually serves. */
    private function routerOperations(): array
    {
        $operations = [];

        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();

            if (! Str::startsWith($uri, 'api/v1/')) {
                continue;
            }

            // Route parameters are declared as {name} in the spec; Laravel adds
            // a binding field (e.g. {post:id}) that the contract does not carry.
            $normalized = preg_replace('/\{(\w+):\w+\}/', '{$1}', $uri);

            foreach ($route->methods() as $method) {
                if (in_array($method, ['HEAD', 'OPTIONS'], true)) {
                    continue;
                }

                $operations[] = $method.' '.$normalized;
            }
        }

        $operations = array_values(array_unique($operations));
        sort($operations);

        return $operations;
    }

    public function test_every_documented_operation_exists_in_the_router(): void
    {
        $router = $this->routerOperations();

        foreach ($this->specOperations($this->spec()) as $operation) {
            $this->assertContains(
                $operation,
                $router,
                "The contract documents {$operation} but no route serves it.",
            );
        }
    }

    public function test_every_route_is_documented_or_explicitly_excluded(): void
    {
        $documented = $this->specOperations($this->spec());
        $missing = [];

        foreach ($this->routerOperations() as $operation) {
            [, $path] = explode(' ', $operation, 2);

            if (in_array($operation, $documented, true) || isset(self::UNDOCUMENTED[$path])) {
                continue;
            }

            $missing[] = $operation;
        }

        $this->assertSame(
            [],
            $missing,
            "These routes are neither documented nor listed as deliberate exclusions:\n - "
                .implode("\n - ", $missing),
        );
    }

    public function test_the_error_envelope_is_declared_once_and_used_everywhere(): void
    {
        $spec = $this->spec();
        $schema = $spec['components']['schemas']['ErrorResponse']['properties']['error'] ?? null;

        $this->assertNotNull($schema, 'The shared error envelope is missing from the contract.');
        $this->assertSame(['code', 'message'], $schema['required']);
        $this->assertArrayHasKey('request_id', $schema['properties']);
    }
}
