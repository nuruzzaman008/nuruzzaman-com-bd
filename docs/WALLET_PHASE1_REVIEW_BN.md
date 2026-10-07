# Offline wallet — Phase 1 review

Scope: migration + unbound service interface/policy + draft API contract only. No new routes/controllers, frontend, AutoCAD or payment/auth changes in this phase. Previous local prototype changes remain separate and are NOT a production deployment package.

## Schema verification

Live information_schema was read over SSH on 2026-09-15 without reading customer records or printing environment secrets. Existing users.id, software_licenses.id and nb_devices.id are unsigned bigint. Existing users, licenses, machine_bindings, nb_devices and nb_token_issues exist. All four wallet tables are absent in production. No production migration was run.

Isolated local MariaDB schema before testing contained the old prototype nb_online_wallets (software_license_id, balance) and nb_wallet_entries (reference, delta, balance). Recreating those names would conflict, so the prior pending creation migration is preserved and the new expansion migration follows it.

## Files and compatibility

Base prerequisite (unchanged): apps/api/database/migrations/2026_09_15_022926_create_nb_online_wallets.php.
New migration: apps/api/database/migrations/2026_09_15_083032_extend_nb_wallet_for_offline_sync.php.

- Wallet: license_id is a virtual alias of existing software_license_id; available_balance is virtual balance minus reserved_balance. Only existing balance is writable as settled balance. reserved_balance, status, version are added. This avoids two independent balances.
- Ledger: unique transaction_id, generated entry_type and amount from delta, source, device_id, created_by, lease_id, device_sequence, request_hash and wallet_version. Existing reference/delta/balance stay intact.
- transaction_id/source remain nullable for LEGACY rows only; no UUIDs or sources are invented/backfilled. Future service MUST require these for new writes. No INSERT/UPDATE/DELETE/backfill in migration.
- Leases: allowance, consumed, released, policy version and immutable policy snapshot, signing-key ID, device, sequence, expiry and sync deadline. Signing keys themselves are never stored here.
- Syncs: per-device request uniqueness, request hash, status, version, sequence range and original response for retry.
- Foreign keys restrict parent deletion. Checks prevent over-reservation and consumed+released above allowance.
- Every expected column/table is preflighted before DDL. Conflicts stop migration. MySQL DDL is not atomic: if interrupted, inspect schema before retry; do not delete tables to get past the check.
- Automatic down() deliberately refuses to delete accounting/reservation history.

The compatibility online-only prototype must not be used concurrently with offline leases. Phase 2 must enforce wallet version/status/reserved-funds checks across ALL wallet mutation paths before offline enablement. Neither flag nor routes are enabled now.

## Service structure

app/Services/Licensing/OfflineWalletLedger.php: interface for balance, adjustment, reserve, sync and history. No implementation or container binding; it cannot modify funds in Phase 1.
app/Services/Licensing/OfflineWalletPolicy.php: validated immutable policy settings.
config/offline_wallet.php: default feature off; first online activation required; 100 tokens maximum allowance; 24-hour lease; 6-hour periodic sync; maximum 100 events per batch. Values configurable via NB_OFFLINE_WALLET_* environment settings. First activation cannot be bypassed through configuration.

Settled balance = available + reserved. Reserving 100 of 1000 yields available=900, reserved=100. Settling 20 usage yields settled=980, available=900, reserved=80. Verified return of 80 unused allowance would yield available=980, reserved=0. Reservation/return events belong to lease/sync audit and must not mint credit. Expiry alone does not prove unused funds and must never auto-release a reservation.

## Proposed routes — not registered

POST /api/wallet/connect
GET /api/wallet/balance
POST /api/wallet/sync
GET /api/wallet/history?limit=25

Machine-readable contract: packages/contracts/wallet-phase1.openapi.yaml. It is separate from the active public OpenAPI contract to avoid claiming unimplemented endpoints exist.

### Connect

Existing pairing and website confirmation happen first. Then authenticated confirmed device requests allowance:

```json
{"request_id":"45c2bf13-8bb8-4890-b69b-60f4a69f0c18","expected_version":0,"requested_allowance":100}
```

Response shape: data.wallet {license_id, available_balance, reserved_balance, status, version}, data.lease {id, device_id, allowance, policy, issued_at, sync_due_at, expires_at, grant}. grant is a signed lease, not a signing key. Same UUID and same body returns original result; it does not reserve twice.

### Balance

```json
{"data":{"wallet":{"license_id":12,"available_balance":900,"reserved_balance":100,"status":"active","version":1},"server_time":"2026-09-15T10:00:00Z","last_sync_at":null}}
```

### Sync

```json
{"request_id":"47e9f71d-561b-48a0-963d-3756c77cdf04","lease_id":"8f9244aa-b009-40eb-9e2c-df264fa47643","expected_version":1,"transactions":[{"transaction_id":"2c7666f2-e7dd-474a-b0f2-d9a96286d843","sequence":1,"command":"NBFOOTING","units":2,"occurred_at":"2026-09-15T10:10:00Z"}]}
```

Response: sync_id, request_id, accepted_transaction_ids, last_sequence, updated wallet, lease_remaining, server_time. Server calculates cost from immutable lease policy; no client-supplied balance/amount accepted. Client time is audit-only. Successful retry returns the original response; same request ID with altered payload => 409. Whole batch is atomic. A transaction already submitted in another batch is a conflict, never a second debit. Reconciliation of expired/uncertain leases needs a dedicated reviewed rule in Phase 2.

### History

```json
{"data":[{"transaction_id":"2c7666f2-e7dd-474a-b0f2-d9a96286d843","type":"debit","amount":2,"source":"offline_usage","device_id":7,"created_by":null,"created_at":"2026-09-15T10:15:00Z"}],"meta":{"next_cursor":null}}
```

## Security flow

1. Keep existing Sanctum email login, verification, CSRF and license ownership checks unchanged.
2. Reuse existing pair + website-confirm flow. Device bearer credential identifies a confirmed binding; email or machine ID alone never authenticates. Only credential hash stored server-side.
3. Derive license/user from credential. Check user/license/wallet state and binding revocation; do not trust client license IDs.
4. For mutations: authenticate, check stored request ID+canonical hash, then version/ownership/policy validation, lock wallet row and atomically append ledger + settle reservation + save sync response.
5. Signing grant implementation, device-side signature verification and key management are Phase 2/AutoCAD work; no keys generated in Phase 1.
6. Admin adjustments later require existing permission checks, actor and reason; payments later use the existing approval/fulfillment integration with one order-item credit only.
7. Offline client cannot receive immediate server revocation. Signed grants/UUIDs do not guarantee protection against disk rollback or a modified binary. First activation is online, allowance limited and sync required; absolute offline rollback protection is not claimed.

## Commands

Run from apps/api against the intended reviewed database after backup. First preview only:

```bash
php artisan migrate --pretend --path=database/migrations/2026_09_15_022926_create_nb_online_wallets.php --path=database/migrations/2026_09_15_083032_extend_nb_wallet_for_offline_sync.php
```

Only after reviewing the SQL and taking a database backup:

```bash
php artisan migrate --path=database/migrations/2026_09_15_022926_create_nb_online_wallets.php --path=database/migrations/2026_09_15_083032_extend_nb_wallet_for_offline_sync.php
```

These commands do not create wallets for users or transfer balances. Never use migrate:fresh on production. The creation migration is skipped automatically if already recorded. This phase executed migrations only through tests on isolated nuruzzaman_test, port 33317; production unchanged.

Tests (isolated test database settings must be configured):

```bash
php vendor/bin/phpunit --filter='OfflineWalletFoundationTest|OnlineWalletTest|OnlineLicensingTest|ManualPaymentTest'
```

From repository root:

```bash
npx redocly lint packages/contracts/wallet-phase1.openapi.yaml --config packages/contracts/redocly.yaml
```

The existing CI auto-deploys main and blocks migration changes. No push/deploy performed. Do not bundle earlier prototype changes into production without a separate review.
