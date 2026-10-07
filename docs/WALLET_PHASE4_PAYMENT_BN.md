# Phase 4 — Manual Payment Approval → Wallet Credit

Status: local implementation and isolated database verification complete. No Phase 4 commit, push, live migration or deployment performed.

## Changed files (Phase 4 only)

- `apps/api/database/migrations/2026_09_19_143347_add_payment_reference_to_wallet_ledger.php`: nullable payment/user references in ledger, unique payment reference constraint, durable payment credit receipt.
- `apps/api/app/Models/Payment.php`: casts stored credit receipt as an array; not client mass assignable.
- `apps/api/app/Services/Payments/ManualPaymentReview.php`: existing authorization/validation, locked atomic approval and replay handling.
- `apps/api/app/Services/Payments/ManualWalletCredit.php`: eligibility, license checks, ledger credit, receipt verification and audit.
- `apps/api/app/Http/Controllers/Api/V1/Commerce/PaymentSelectionController.php`: delegates review; returns and lists wallet credit receipt.
- `apps/api/app/Services/Commerce/OrderStateMachine.php`: prevents validated manual payments bypassing atomic review when transitioning to paid.
- `apps/api/app/Services/Licensing/OnlineWalletService.php`: recognizes already credited manual orders; prevents subsequent refill credit or changing the target license.
- `apps/api/app/Services/Licensing/OnlineLicensingService.php`: prevents wallet-credited orders being reissued through the unmanaged/offline license path.
- `apps/web/src/features/dashboard/manual-payments.tsx`: approval amount and transaction ID, replay and persisted receipt messages.
- `apps/api/tests/Feature/ManualWalletPaymentTest.php`: approval, retries, permissions, rollback, ambiguity, bypass, invalid quantity and legacy issuance tests.
- `apps/api/tests/Feature/ManualWalletConcurrencyTest.php`: two independent PHP workers approve the same payment under real database locking.
- `apps/web/tests/unit/manual-payment-wallet.test.tsx`: approval, replay and persisted receipt UI tests.
- This report.

Earlier Phase 1–3 and prototype files remain in the working tree. This list does not claim those changes as Phase 4 work.

## Migration

Adds `nb_wallet_entries.payment_id` (nullable, unique, foreign key), `user_id` (nullable, foreign key), and `payments.wallet_credit_result` (nullable JSON). Existing ledger columns already hold transaction ID, license, amount/delta, reason, actor, reference and timestamp.

No historical payment/ledger data is backfilled or modified. The migration checks prerequisite Phase 3 columns and refuses conflicting new columns. Its `down()` intentionally refuses destructive removal of financial references; use a reviewed forward migration for schema corrections.

Migration was applied only to disposable `nuruzzaman_test` on local port 33317. `migrate:status` reports this migration Ran there. Production status was not changed.

For a separately approved environment, after backup and installing prerequisite Phase 1–3 migrations, the normal command from `apps/api` is:

```sh
php artisan migrate --pretend
php artisan migrate
```

Review all pending migrations first. These commands are documentation, not a request to migrate production now.

## Routes and permissions

No new route or permission. Existing session authentication, CSRF flow, active/verified account checks, admin role checks and `orders.manage` remain in use. Payment approvers do not additionally need `wallets.manage`.

- `POST /api/v1/admin/manual-payments/{submission_id}/review`
- `GET /api/v1/admin/manual-payments?status=approved`

Submission, proof upload, payment settings and customer payment selection are unchanged. Review request remains:

```json
{"decision":"approved","note":"Statement checked","confirmed_amount_minor":559900}
```

The confirmed amount is the money received in minor currency units, not tokens. Token amount comes from the immutable order-item `fulfillment_meta.credit_amount` multiplied by quantity.

New response data for an eligible payment:

```json
{"decision":"approved","wallet_credit":{"eligible":true,"already_credited":false,"amount":1000,"transaction_id":"<uuid>","license_id":12}}
```

Repeated approval returns the same UUID and `already_credited:true`.

## Exact business flow

1. Authorize existing payment approver; validate the existing request.
2. Begin database transaction; lock order, submission and payment. Retried already-approved submissions verify the saved ledger receipt and return it.
3. Verify money/currency match and pending state.
4. Resolve wallet eligibility from credit-refill order items and an existing wallet/license owned by the purchaser. Check usable license, active verified owner, wallet status and token snapshot.
5. Lock license and wallet. Append ledger entry (`action_type=payment_credit`, `source=manual_payment`) with UUID, unique payment ID, unique order reference, user/license/admin IDs, amount, reason and timestamp. Update the wallet balance projection/version within that same transaction; reserved balance is unchanged.
6. Save the durable payment receipt, mark payment validated/order paid, save review and audit records. Any failure rolls back the entire operation, including ledger and balance.
7. Commit before dispatching existing fulfillment. Wallet credit does not depend on a queue job. Subsequent legacy refill calls cannot mint the same credit again.
8. Admin sees Payment Approved, Wallet Credited amount and Wallet Transaction ID. Replay/list refresh shows Already Credited and the same ID.

No-wallet/non-refill payments retain normal approval behavior and persist an explicit noneligible receipt. Feature flags cannot silently bypass an existing eligible wallet.

## Verification

- Backend regression filter: **167 tests, 879 assertions passed** (admin, wallet, payment, licensing, activation, fulfillment and refund suites matching the filter below).
- Real concurrent approval: **1 test, 16 assertions passed**. Two PHP processes, same payment, one ledger entry, one balance increment, same transaction ID.
- Frontend: **6 tests passed** across manual-payment-wallet and existing wallet-management tests.
- Frontend workspace TypeScript check passed.
- Laravel Pint passed after formatting.
- Targeted ESLint and `git diff --check` passed.
- Migration status and existing manual-payment routes verified on isolated local environment.

Backend commands from `apps/api`, with `DB_CONNECTION=mysql`, `DB_DATABASE=nuruzzaman_test`, `DB_PORT=33317` and test-only credentials in the process environment:

```sh
php vendor/bin/pint --dirty --format agent
php vendor/bin/phpunit --filter='Admin|Wallet|Payment|Licensing|ActivationRequest|Fulfillment|Refund' --exclude-group=wallet-concurrency --stop-on-failure
php vendor/bin/phpunit --group=wallet-concurrency
php artisan migrate:status --path=database/migrations/2026_09_19_143347_add_payment_reference_to_wallet_ledger.php
php artisan route:list --path=admin/manual-payments
```

The concurrency test deliberately rebuilds its disposable database and refuses to run unless the application environment is testing and database name is exactly `nuruzzaman_test`. Never point test configuration at any important database. Run it separately, not alongside other database tests.

Frontend commands from repository root:

```sh
npm run test --workspace @nuruzzaman/web -- tests/unit/manual-payment-wallet.test.tsx tests/unit/wallet-management.test.tsx
npm run typecheck --workspace @nuruzzaman/web
```

## Known limitations / future work

- Only credit-refill purchases for existing managed wallets qualify. This phase does not create wallets, issue activation grants, or change provisioning.
- Multiple eligible licenses require an existing explicit refill/license assignment; ambiguous orders fail with 409. No new license-selection UI was added because the existing payment flow must remain unchanged.
- Orders older than wallet creation or with previously issued credit require reconciliation. Previously approved historical payments are not automatically credited retroactively.
- Older manual payments without a credit receipt cannot later be silently credited through the legacy online wallet service; reconcile them explicitly before migration to the wallet system.
- Token quantity is capped at 1,000,000 per approval; invalid snapshots fail rather than crediting a guessed amount.
- Refund/cancellation reversal is not implemented. Payment/order references support a future compensating ledger entry; never delete the original credit or manually alter the balance for refunds. Existing refund tests pass, but existing refund processing does not reverse this new wallet credit.
- Existing fulfillment still occurs after commit; if a fulfillment job fails, retry that existing job. The committed wallet credit remains idempotent.
- No live/admin-browser payment was performed. Verification used the isolated backend database and UI component tests, not real money or production accounts.
