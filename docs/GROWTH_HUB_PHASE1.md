# My Growth Hub — Phase 1

## Architecture and access

The existing Next.js App Router dashboard hosts `/dashboard/growth-hub`. Laravel
serves `/api/v1/admin/growth-hub/*` through existing Sanctum cookies, CSRF,
active-account, verified-email, staff MFA and `role:super_admin` checks. Every
record query is also scoped to the authenticated owner. No new authentication,
wallet, licensing, payment or public website architecture is introduced.

The implementation uses Laravel 13, Next.js 16, React 19 and the existing admin
theme/Button/API client. No package dependencies are added. Private pages are
dynamic and noindex. Provider requests happen only on the server.

## Features

- Configurable dashboard cards, timezone/name/interests, real empty states.
- Goals: vision → long term → annual → quarterly → monthly → weekly → daily,
  parent hierarchy/cycle validation, dates, priority, notes, progress and Kanban.
- Daily tasks, unique Top 3 slots per date, linked goals and historical reviews.
  Task due timestamps use UTC (the form labels this explicitly).
- Idea Inbox with search, pagination and CRUD.
- Ask My AI: conversations, rename/archive/delete/search, explicit goals/tasks/
  ideas context, provider fallback and usage history. Review an AI response as
  a goal draft, edit it, then explicitly Save. AI has no database-write tools.
- Encrypted provider settings for OpenAI, Gemini, Anthropic, OpenRouter and
  approved custom OpenAI-compatible endpoints. Empty key on edit preserves the
  saved key; Remove saved key explicitly clears it. Responses expose no key.

Gmail, engineering-source retrieval, learning, projects and CRM are later phases.
Gmail is visibly disconnected. AI engineering suggestions are unverified; no
fabricated BNBC citations are presented as authoritative.

## Database

Migration: `2026_09_27_113543_create_growth_hub_tables.php`.
It creates nine `growth_*` tables: goals, tasks, ideas, daily_reviews,
preferences, ai_providers, conversations, messages and ai_logs. Only the existing
users table is referenced; no existing user/payment/license/wallet data is changed.
The down migration removes only these nine tables in reverse dependency order.

Back up the target database and verify pending migrations before applying:

```sh
php artisan migrate:status
php artisan migrate --pretend --path=database/migrations/2026_09_27_113543_create_growth_hub_tables.php
php artisan migrate --force --path=database/migrations/2026_09_27_113543_create_growth_hub_tables.php
```

Do not use an unrestricted migrate command to unintentionally apply the unrelated
wallet migrations currently present in the development working tree. Do not use
`migrate:fresh` on an existing environment.

## Private API contract

All paths below are relative to `/api/v1/admin/growth-hub`. Unauthorized requests
return 401/403; foreign record IDs return 404. Validation errors use the existing
API error envelope. Lists return `{data: [...], meta: {page, last_page, total}}`
with 30 records per page (provider list is an unpaginated configuration list).

| Route                              | Methods       | Input / response                                                                                                                  |
| ---------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| dashboard                          | GET           | name/date/hour/preferences, focus/overdue/goals/ideas/counts, AI/Gmail state                                                      |
| preferences                        | GET, PUT      | display_name, profession, timezone, interests, cards[]                                                                            |
| goals                              | GET, POST     | q/status/page; title, description, category, parent_id, horizon, why, notes, start_date, target_date, status, priority, progress  |
| tasks                              | GET, POST     | q/status/page; title, description, category, goal_id, due_at, focus_date, focus_rank, status, priority, source                    |
| ideas                              | GET, POST     | q/status/page; title, description, category, status                                                                               |
| goals/{id}, tasks/{id}, ideas/{id} | PUT, DELETE   | full editable record including title, or delete                                                                                   |
| reviews                            | GET, PUT      | review_date, completed, learned, pending, tomorrow, lesson; upsert by owner/date                                                  |
| providers                          | GET, POST     | provider, display_name, model, api_key, base_url, enabled, is_default, priority, purpose, monthly_budget, input_rate, output_rate |
| providers/{id}                     | PUT, DELETE   | same fields; optional clear_key                                                                                                   |
| providers/{id}/test                | POST          | small actual provider request; connected or safe validation error                                                                 |
| ai-history                         | GET           | paginated provider/model/feature/status/time/tokens/estimated cost; no raw errors                                                 |
| conversations                      | GET, POST     | q/archived/page; title                                                                                                            |
| conversations/{id}                 | PATCH, DELETE | title and archived                                                                                                                |
| conversations/{id}/messages        | GET, POST     | latest 50 messages; send content and explicit context[] (goals/tasks/ideas)                                                       |

Routes are private handwritten-client endpoints, individually excluded from the
generated public contract in ApiContractTest, with this document as their contract.

## AI configuration and privacy

No credentials are seeded. The owner configures provider/model/key in Settings
and clicks Test Connection; a configured provider may charge for this test.
Keys are encrypted using the existing Laravel APP_KEY. Back up that key securely;
do not rotate it casually or expose it to Next.js.

Optional server environment setting:

```dotenv
GROWTH_AI_CUSTOM_BASE_URLS=https://your-approved-provider.example/v1
```

Custom URLs require an exact server allowlist match and HTTPS; redirects are
disabled. This setting must contain only administrator-reviewed provider endpoints.
Clear/rebuild Laravel's config cache after changing it. Built-in providers need
no new environment variables. Existing Next.js API/proxy configuration remains.

Only selected owned context (latest 10 records per category) and the conversation's
recent messages are transmitted to configured providers, including fallbacks.
Start a new conversation to discard previous conversational context. No email or
other website customer data is included. AI responses are rendered as plain text.

Budget amounts are USD, prices are USD per million tokens. Enter current provider
prices. Estimated budgets are serialized per provider; failed/uncertain calls are
conservatively logged. These are estimates, not a guarantee of the provider's
invoice. Provider billing limits remain authoritative. Requests have connection/
response timeouts; no background AI jobs or Gmail jobs are enabled in this phase.

## Verification and deployment

Targeted tests: GrowthHubTest, ApiContractTest and existing authentication tests;
frontend `tests/unit/growth-hub.test.tsx`, ESLint and Next production build.
The existing GitHub deployment gate includes GrowthHubTest.

Local regression tests use a separate disposable `growth_hub_test` database on
127.0.0.1:33319. They do not use the wallet E2E database on 33318 or production.
Provider tests use mocked responses, never real paid requests or production keys.

Before deployment, compare the live revision and isolate only Growth Hub changes
from other uncommitted development work. This Windows build is validation only;
the cPanel release must be built for Linux through the existing CI deployment
workflow. Keep current production configuration, storage and APP_KEY intact.

Rollback: restore the backed-up code/release and clear/rebuild Laravel caches.
Leave the new tables in place to preserve any entered Growth Hub data. A database
down migration is optional and destructive to Growth Hub data; export those tables
first and verify the migration is the exact intended batch/path. Never roll back
unrelated migrations, users or wallets.

## Next phase

Phase 2: Daily Learning, legally supplied knowledge sources/Knowledge Vault,
verified BNBC Daily, Formula Library and Engineering Notebook. Source retrieval
and verification must precede authoritative engineering claims.
