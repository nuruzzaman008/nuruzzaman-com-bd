# Phase 2 — Wallet backend implementation

## Recheck scope — 2026-09-20

The user requested Phase 2 again after later phases had been implemented. The four backend endpoints already exist; this recheck preserves their implementation rather than creating duplicate routes/authentication or deleting later work. No additional backend, admin, payment, frontend or AutoCAD code was changed during this recheck. Only this report was updated.

The sections below record the original Phase 2 implementation. Historical statements about later phases being absent (for example the adjustment boundary returning 501) describe the original delivery, not the current combined working tree. Existing Phase 3–5 work remains untouched, including the additive authenticated identity field in balance responses.

Authentication, device/license ownership, canonical payload hashing, exact-request replay, contiguous sequence validation and transactional ledger/balance updates were inspected again. New requests must use new UUIDs; an uncertain/lost-response retry must retain the exact original request ID and body. Do not blindly resubmit an uncertain batch under a new ID after a version conflict; reconcile its prior result first.

Recheck results: **47 tests passed / 301 assertions**, using the Phase 2 regression filter documented below. The route list confirmed all four endpoints with device authentication and throttling. Both Phase 1 migrations show **Ran, batch 1** in disposable local `nuruzzaman_test` on port 33317. No new migration was added; production migration status was neither queried nor changed. The isolated database server was shut down after verification.

Verified locally: 2026-09-15. No production connection, migration, deployment or Git push in this phase.

## Scope and authentication

Implemented POST `/api/wallet/connect`, GET `/api/wallet/balance`, POST `/api/wallet/sync`, GET `/api/wallet/history`.

Existing device pairing and authentication are reused: `/api/v1/licensing/pair` followed by the existing authenticated account confirmation at `/api/v1/account/connect-device`. Send the confirmed device's existing secret as a Bearer credential. A website session alone does not identify a device. No new login system or token issuance endpoint was added.

The license must belong to an active, verified user, be usable under existing licensing rules and belong to a paid order. The confirmed device must have an active machine binding and must not have been superseded. The wallet must already exist and be active. Provisioning/crediting wallets is outside this phase; tests use isolated fixtures.

## Files changed in this phase

All paths below are relative to the repository root. Existing unrelated work remains in the working tree.

| File | Purpose |
|---|---|
| `apps/api/routes/api_wallet.php` | Four routes with device middleware and rate limiting |
| `apps/api/routes/api.php` | Registers routes outside the existing v1 prefix |
| `apps/api/app/Http/Controllers/Api/WalletController.php` | Request-to-service response handling |
| `apps/api/app/Http/Middleware/AuthenticateWalletDevice.php` | Existing credential, license and device checks; feature gate |
| `apps/api/app/Http/Requests/WalletConnectRequest.php` | UUID, strict integer and unknown-field validation |
| `apps/api/app/Http/Requests/WalletSyncRequest.php` | Bounded ordered batches, UUIDs and usage validation |
| `apps/api/app/Http/Requests/WalletHistoryRequest.php` | Bounded cursor pagination |
| `apps/api/app/Services/Licensing/SqlOfflineWalletLedger.php` | Atomic reservation, settlement, history and replay handling |
| `apps/api/app/Services/Licensing/WalletLeaseSigner.php` | RSA SHA-256 signed offline grants |
| `apps/api/app/Services/Licensing/OfflineWalletLedger.php` | Updates service-boundary documentation |
| `apps/api/app/Services/Licensing/OnlineWalletService.php` | Stops legacy spending from bypassing leases once a license has lease history |
| `apps/api/app/Providers/AppServiceProvider.php` | Binds ledger interface to SQL implementation |
| `apps/api/config/offline_wallet.php` | Signing key path and key ID configuration; disabled by default |
| `apps/api/tests/Feature/OfflineWalletApiTest.php` | API, signature, ownership, rollback and replay tests |
| `apps/api/tests/Feature/OfflineWalletFoundationTest.php` | Updates Phase 1 expectations for registered but disabled routes |
| `packages/contracts/wallet.openapi.yaml` | Implemented API contract; reviewed Phase 1 draft preserved separately |
| `docs/WALLET_PHASE2_BACKEND_BN.md` | This report and request examples |

No new migration or frontend/AutoCAD changes were made in Phase 2. Existing authentication and payment implementations were not replaced. The compatibility guard in the older wallet service prevents spending reserved funds through its old operation endpoint.

## Atomicity, retries and security

- License/device/wallet rows are checked inside write transactions; wallet writes use row locks and version checks.
- Connect reserves existing funds, increments version and stores a signed grant and its original response. It does not mint tokens.
- Canonical SHA-256 payload hashes are computed server-side. Reusing a request ID with a changed payload returns 409. Identical retries return the stored result without spending twice. This is replay-integrity checking, not proof that an untrusted offline client really performed an operation.
- Sync requires contiguous device sequences and globally unique transaction IDs. Costs come from the server's immutable lease pricing snapshot; caller-supplied costs/balances are rejected.
- Daily pricing uses the server's lease issuance day. Client timestamps cannot choose a cheaper pricing day.
- A failed batch rolls back every entry and balance change. Owned-lease rejected batches retain an audit record and replay their rejection. Authentication, ownership and request-validation failures are rejected before this audit stage.
- Successful batches atomically append entries, reduce reserved/settled balance, advance version and store the sync response. Available balance stays unchanged when previously reserved funds are consumed.
- History is limited to the authenticated license; zero-cost usage is returned as a zero-amount debit.
- RSA private keys stay outside database responses. Grants contain the key ID and signed claims, not the private key. Require HTTPS when eventually enabled outside local testing.

## Local configuration prerequisites

These values describe a separate local/test environment; no existing `.env` was modified:

```dotenv
NB_ONLINE_LICENSING=true
NB_ONLINE_WALLET=true
NB_OFFLINE_WALLET_ENABLED=true
NB_OFFLINE_WALLET_SIGNING_KEY_PATH=/absolute/private/path/wallet-test-private.pem
NB_OFFLINE_WALLET_SIGNING_KEY_ID=wallet-test-1
NB_OFFLINE_WALLET_MAX_ALLOWANCE=100
NB_OFFLINE_WALLET_LEASE_SECONDS=86400
NB_OFFLINE_WALLET_SYNC_SECONDS=21600
NB_OFFLINE_WALLET_MAX_BATCH=100
```

Supply an RSA private key of at least 2048 bits, outside the public directory, readable only by the application account. Missing/invalid signing configuration fails closed. Tests generate and remove their own temporary key; no production key was generated.

## Sample requests

The following Bash examples assume a separately running LOCAL Laravel API on port 8000 and an already confirmed device with a funded wallet. They are examples, not commands executed against the live site. Put the existing device credential in `DEVICE_TOKEN` privately; do not paste it into reports or shell history.

```bash
API=http://127.0.0.1:8000/api
curl -sS "$API/wallet/balance" \
  -H "Authorization: Bearer $DEVICE_TOKEN" -H 'Accept: application/json'
```

Example connect body (`connect.json`). Replace `expected_version` with the balance response's version and generate a fresh UUID for each new logical request:

```json
{
  "request_id": "d317c596-e87c-480d-aa48-64577b7c4efe",
  "expected_version": 0,
  "requested_allowance": 20
}
```

```bash
curl -sS "$API/wallet/connect" \
  -H "Authorization: Bearer $DEVICE_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' --data-binary @connect.json
```

Response contains `data.wallet` and `data.lease` including `id`, `grant`, `issued_at`, `sync_due_at`, `expires_at` and policy. For an initial 100-token wallet reserving 20, available becomes 80, reserved 20, version 1.

Example sync body (`sync.json`). Replace the example lease UUID with the actual connect result, use its wallet version and the next sequence:

```json
{
  "request_id": "705faf57-a394-4270-a7bc-6776bf9ddf37",
  "lease_id": "41cc22a3-e55f-4ad9-b849-e7f704a18d42",
  "expected_version": 1,
  "transactions": [
    {
      "transaction_id": "8f35d46c-ffda-4661-ac38-6a62dd2cdd35",
      "sequence": 1,
      "command": "NBFOOTING",
      "units": 2,
      "occurred_at": "2026-09-15T10:00:00Z"
    }
  ]
}
```

```bash
curl -sS "$API/wallet/sync" \
  -H "Authorization: Bearer $DEVICE_TOKEN" -H 'Accept: application/json' \
  -H 'Content-Type: application/json' --data-binary @sync.json

curl -sS "$API/wallet/history?limit=20" \
  -H "Authorization: Bearer $DEVICE_TOKEN" -H 'Accept: application/json'
```

Accepted sync response contains `sync_id`, accepted transaction IDs, last sequence, wallet, remaining lease allowance and server time. History returns `data` and `meta.next_cursor`; use that cursor for the next page. On a version conflict fetch balance and submit a new logical request with a new request ID. To retry a lost response, keep the original ID and body unchanged.

## Verification and migration status

- PHPUnit: **46 tests passed, 294 assertions**. Includes OfflineWalletApiTest, OfflineWalletFoundationTest, OnlineWalletTest, OnlineLicensingTest and ManualPaymentTest.
- Tested signatures, exact retry responses, changed payload rejection, duplicate transactions, ownership, disabled/blocked/revoked/deleted accounts, expiry, overdraw, atomic batch rollback, rejected audit records and legacy spend protection.
- Laravel route inspection confirmed exactly the four requested wallet routes.
- Pint completed; `git diff --check` passed. Redocly validated the implemented contract with one informational license-metadata warning (proprietary license has no URL/identifier).
- Existing Phase 1 migrations `2026_09_15_022926_create_nb_online_wallets` and `2026_09_15_083032_extend_nb_wallet_for_offline_sync` show **Ran** in the disposable local MariaDB database `nuruzzaman_test`, port **33317**.
- Production migration status was not queried or changed in Phase 2. Normal local application data was not migrated. Phase 1 migration definitions were not changed.

Repeat tests only with an isolated test database. PHPUnit RefreshDatabase can rebuild that database; never point these commands at production or an important local database. From `apps/api`, after setting test-only DB environment values and a working OpenSSL configuration:

```bash
php vendor/bin/phpunit --filter='OfflineWalletApiTest|OfflineWalletFoundationTest|OnlineWalletTest|OnlineLicensingTest|ManualPaymentTest'
php artisan route:list --path=api/wallet --json --no-interaction
php artisan migrate:status --path=database/migrations/2026_09_15_022926_create_nb_online_wallets.php --path=database/migrations/2026_09_15_083032_extend_nb_wallet_for_offline_sync.php --no-interaction
```

No additional Phase 2 migration command is needed on the tested database. For a fresh isolated environment with the preceding project schema installed, the existing two migration files must run in chronological order. Their status must be checked first. Production migration and activation remain a separate, unperformed step.

## Remaining limitations

1. No admin/payment crediting or reconciliation integration. Those future writers must respect reservations and advance wallet versions. The existing ledger adjustment interface deliberately returns 501 in this implementation and has no API route.
2. Expired or lost-device allowance is not automatically returned: it stays reserved pending a future explicit reconciliation flow. Partial leases are not renewed automatically. Only fully consumed leases settle automatically.
3. The grant advertises a six-hour sync deadline and a 24-hour hard expiry by default. Backend accepts outstanding usage until expiry; periodic client enforcement, empty heartbeat sync and renewal are not implemented. Batch sync requires at least one usage entry.
4. Offline client signing-key verification, protected local storage and anti-rollback/device reinstall handling require the later AutoCAD phase. Backend idempotency alone cannot prevent a tampered offline executable from replaying local work before reconnecting.
5. Future signing-key rotation/public-key distribution and manual recovery policy need implementation before client rollout.
6. Functional transaction/replay tests ran on MariaDB. Multi-process race/load testing and production host verification have not been performed.
7. The new API remains disabled by default. No live availability claim is made; no production deployment or Git push occurred.
