# Phase 3 — Admin Wallet Management

কোড repository-তে তৈরি ও local isolated database-এ পরীক্ষা হয়েছে। Production database, hosting, payment approval বা AutoCAD integration পরিবর্তন করা হয়নি। Git push/deployment করা হয়নি।

## Dashboard

নতুন page: `/dashboard/wallets`। Existing admin sidebar-এ permission অনুযায়ী Wallet Management link দেখা যাবে।

- User name, email বা license code দিয়ে search, pagination।
- User, email, license, total balance, available tokens, reserved tokens, status ও last successful sync।
- Transaction history: amount change, resulting balance, action type, admin ID, reason, reference note ও status transition।
- Device list: confirmation, latest sync result/time, sync deadline ও lease expiry। Device secrets বা encrypted machine identifiers ফেরত দেওয়া হয় না।
- Add Token, Deduct Token এবং Active/Suspended/Blocked status পরিবর্তন।
- View-only staff-এর জন্য mutation buttons লুকানো; backend permission check-ও বাধ্যতামূলক।

শুধু আগে থেকে provisioned wallet দেখা/পরিচালনা করা যায়। Existing offline license স্বয়ংক্রিয়ভাবে convert বা নতুন wallet credit করা হয় না।

## Ledger ও audit behaviour

প্রতিটি action-এর জন্য UUID transaction ID, expected wallet version, reason এবং reference note প্রয়োজন। Admin ID logged-in session থেকে নেওয়া হয়; request-এ admin ID বা সরাসরি balance পাঠালে reject হয়।

| Action | Ledger action_type | Balance effect |
|---|---|---|
| Add Token | `admin_credit` | Positive delta |
| Deduct Token | `admin_debit` | Negative delta, available balance-এর মধ্যে |
| Status change | `admin_status_change` | Zero delta |

Ledger insert, balance projection/version update এবং existing audit log একই database transaction-এ হয়। Audit save ব্যর্থ হলে balance ও entry rollback হয়। কোনো raw balance-edit endpoint নেই। Reserved balance পরিবর্তন করা হয় না। Suspended/blocked wallet-এ token adjustment বন্ধ; আগে audited status action দিয়ে active করতে হবে। Existing closed wallet এই UI দিয়ে reopen করা যায় না।

একই ID ও একই payload retry করলে আগের response ফেরত আসে। Payload/admin/license বদলে একই ID ব্যবহার করলে 409। UI-ও unchanged retry-এ transaction ID ধরে রাখে। Stale version হলে refresh করে নতুন action দিতে হবে। Concurrent writes row locks ও database unique constraint দিয়ে সুরক্ষিত।

পুরোনো online-only spend service-এ inactive wallet rejection এবং spend-এর পরে wallet version increment যোগ হয়েছে, যাতে ওই পথ দিয়ে block বা version protection এড়ানো না যায়। Payment credit flow পরিবর্তন করা হয়নি।

## Database changes

নতুন migration:

`apps/api/database/migrations/2026_09_15_133547_add_admin_audit_to_nb_wallet_entries.php`

- `nb_wallet_entries`-এ nullable `action_type`, `reason`, `reference_note`, `status_before`, `status_after`, `action_response`।
- Wallet status enum-এ `suspended` যোগ; existing active/blocked/closed values রাখা হয়েছে।
- Existing balances/entries rewrite বা backfill করা হয়নি। Schema prerequisites এবং conflicting columns আগে check করা হয়।
- History হারানোর ঝুঁকির কারণে automatic down migration ইচ্ছাকৃতভাবে বন্ধ; rollback-এর জন্য reviewed forward migration প্রয়োজন।

Migration status: আলাদা local MariaDB test database `nuruzzaman_test`, port `33317`-এ **Ran** যাচাই হয়েছে। সাধারণ local application database বা production database-এ Phase 3 migration চালানো হয়নি।

## New routes

| Method | Route | Permission |
|---|---|---|
| GET | `/api/v1/admin/wallets?q=...&page=1` | `wallets.view` |
| GET | `/api/v1/admin/wallets/{license}?page=1&device_page=1` | `wallets.view` |
| POST | `/api/v1/admin/wallets/{license}/actions` | `wallets.manage` |

সব route existing Sanctum session, active user, verified email এবং staff role checks ব্যবহার করে। Mutation route-এ rate limit 30/minute। Existing CSRF middleware এবং browser API client's XSRF handling অপরিবর্তিত আছে।

Example action body:

```json
{
  "transaction_id": "fd1e19dd-94a2-4454-89c6-e72d4f33d909",
  "expected_version": 3,
  "action": "add",
  "amount": 100,
  "reason": "Verified balance correction",
  "reference_note": "Review CASE-123"
}
```

Deduction-এর জন্য `action: deduct`। Status change-এর জন্য `action: status`, `status: active|suspended|blocked`; `amount` পাঠাবেন না।

## Permission changes

Existing permission system-এ `wallets.view` ও `wallets.manage` যোগ হয়েছে। Admin role default-এ দুটো পাবে; super admin existing implicit permission behaviour ব্যবহার করে। Customer, support, editor বা instructor-কে নতুন permission স্বয়ংক্রিয়ভাবে দেওয়া হয়নি।

`WalletPermissionSeeder` শুধু এই permissions যোগ এবং admin role-এ attach করে; অন্য role grants reset করে না। Existing installation-এ broad RoleSeeder rerun করার প্রয়োজন নেই।

## Changed files — Phase 3 only

Earlier phases-এর unrelated working-tree changes এই তালিকার বাইরে।

| File | Change |
|---|---|
| `apps/api/app/Http/Controllers/Api/V1/Admin/WalletController.php` | Search, detail/history/device queries, action dispatch |
| `apps/api/app/Http/Requests/AdminWalletActionRequest.php` | Permission, amount, reason, reference ও unknown-field validation |
| `apps/api/app/Services/Licensing/AdminWalletService.php` | Atomic ledger actions, replay checks, audit trail |
| `apps/api/app/Services/Licensing/OfflineWalletLedger.php` | Admin adjustment reference-note boundary |
| `apps/api/app/Services/Licensing/SqlOfflineWalletLedger.php` | Authorized adjustment delegation |
| `apps/api/app/Services/Licensing/OnlineWalletService.php` | Legacy spend status/version compatibility guards |
| `apps/api/routes/api_admin.php` | Three permission-protected routes |
| `apps/api/database/migrations/2026_09_15_133547_add_admin_audit_to_nb_wallet_entries.php` | Additive audit schema and suspended status |
| `apps/api/database/seeders/RoleSeeder.php` | Permission vocabulary for fresh databases |
| `apps/api/database/seeders/WalletPermissionSeeder.php` | Additive permission setup for existing databases |
| `apps/api/tests/Feature/AdminWalletTest.php` | Ten backend feature/security tests |
| `apps/web/src/app/(admin)/dashboard/wallets/page.tsx` | Private admin page |
| `apps/web/src/app/(admin)/layout.tsx` | Permission-aware sidebar link |
| `apps/web/src/features/dashboard/wallet-management.tsx` | Wallet management UI |
| `apps/web/tests/unit/wallet-management.test.tsx` | Three UI interaction tests |
| `docs/WALLET_PHASE3_ADMIN_BN.md` | This report |

## Test results

- Combined backend regression run: **56 tests passed, 364 assertions** (AdminWallet, OfflineWalletApi/Foundation, OnlineWallet, OnlineLicensing, ManualPayment).
- After adding device privacy assertions, the affected AdminWallet suite reran: **10 tests passed, 75 assertions**.
- UI: **3 tests passed** — audited adjustment/search, view-only controls, same-ID retry after a lost response.
- TypeScript/Next route type generation: passed.
- Targeted ESLint, Pint and `git diff --check`: passed.
- Route inspection confirmed all three routes and permission middleware.
- Explicit CSRF test rejects a stateful request without protection (419) and accepts the token-protected request.
- Audit failure rollback, reserved-token protection, invalid/spoofed inputs, role/permission denial, duplicate request handling and legacy blocked spending are tested.

No production build, live browser walkthrough or multi-process load test was performed. Local HTTP feature tests and UI component tests do not imply the feature is deployed.

## Local setup and test commands

Run from `apps/api` only after selecting a backed-up LOCAL development database with the earlier project/Phase 1 migrations applied. These commands were not run against your normal app database or production:

```bash
php artisan migrate:status --no-interaction
php artisan migrate --path=database/migrations/2026_09_15_133547_add_admin_audit_to_nb_wallet_entries.php --no-interaction
php artisan db:seed --class=WalletPermissionSeeder --no-interaction
```

Then sign in with the existing admin account and open `/dashboard/wallets` on the local website. An empty list means no wallets are provisioned in that database. No automatic opening credit or legacy license conversion is included.

Tests use RefreshDatabase: use a disposable test database only, never your normal development or production database.

```bash
php vendor/bin/phpunit --filter='AdminWalletTest|OfflineWalletApiTest|OfflineWalletFoundationTest|OnlineWalletTest|OnlineLicensingTest|ManualPaymentTest'
```

From the repository root:

```bash
npm run test --workspace @nuruzzaman/web -- tests/unit/wallet-management.test.tsx
npm run typecheck --workspace @nuruzzaman/web
```

## Remaining scope

Payment approval integration, AutoCAD integration, expired/lost-device lease reconciliation and production deployment remain separate work. Blocking takes effect on future server requests; it cannot remotely stop an already-offline software instance. An expired lease's reserved tokens are not automatically released. This page does not change existing user or license status when it changes wallet status.
