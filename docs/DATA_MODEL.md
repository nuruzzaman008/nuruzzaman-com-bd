# Data model

MySQL 8, InnoDB, `utf8mb4_unicode_ci`, strict SQL mode. Every table has foreign
keys; soft deletes are used only where an audit or legal need justifies keeping
the row.

The test suite runs on SQLite in memory, so migrations use the schema builder
only. The one exception is documented in
`2026_01_01_000520_add_cross_module_foreign_keys.php`: SQLite cannot add a
constraint to an existing table, so three late-bound foreign keys are applied
only on drivers that support `ALTER TABLE ... ADD CONSTRAINT`.

## Identity and access

```text
users ──1:1── profiles
  │
  ├──*── role_user ──*── roles ──*── permission_role ──*── permissions
  ├──*── orders, enrollments, download_entitlements, software_licenses
  └──*── activation_requests, support_tickets, certificates
```

* `users` carries `status`, `locale`, `timezone`, `mfa_secret` (encrypted) and
  soft deletes.
* Roles are the fixed vocabulary from `App\Enums\Role`; permissions are seeded by
  `RoleSeeder` and are the unit policies check.
* `sessions` is Laravel's own table, used for the device list when the session
  driver is `database`.
* `audit_logs` records sensitive actions. `App\Support\Audit` redacts passwords,
  tokens, store credentials and machine identifiers before writing.
* `idempotency_keys` backs the `idempotent:` middleware.

## Content and SEO

```text
authors ──*── posts ──*── post_revisions
                │
                ├──*── category_post ──*── categories (self-referencing tree)
                ├──*── post_tag ──*── tags
                └──1:1── seo_meta (polymorphic)

pages ──1:1── seo_meta
media  (uploaded_by -> users)
redirects
publishing_events (polymorphic)
```

**Invariants**

* A post is public only when `status = published` **and** `published_at <= now`.
* Every edit writes a `post_revisions` row before the update, so a restore is
  always possible.
* `pages.requires_legal_review` + `legal_reviewed` drive the visible DRAFT
  notice; the page still renders, it just cannot pretend to be approved.

## Commerce

```text
products ──*── product_variants ──*── prices
                     │                 (append-only; publishing a new price
                     │                  deactivates the previous one)
                     ├──*── bundle_items (variant -> variant)
                     └──*── download_asset_product_variant ──*── download_assets

carts ──*── cart_items ──> product_variants
orders ──*── order_items         (immutable snapshot of name, sku, price)
   │     ──*── order_status_events
   │     ──1:1── invoices
   │     ──*── payments ──*── payment_events (unique fingerprint)
   │     ──*── refunds
   └──*── download_entitlements ──*── download_events
```

**Invariants**

* Money is an unsigned integer in minor units. There is no float anywhere in the
  commerce path; `App\Support\Money` is the only arithmetic.
* `order_items` snapshots the purchased name, SKU and unit price, so a later
  catalogue edit cannot rewrite history.
* An order status only changes through `OrderStateMachine`, which validates the
  transition and writes an `order_status_events` row plus an audit entry.
* `payment_events.fingerprint` is unique, so a duplicated or replayed IPN is
  stored once and processed once.
* A `download_assets` row without a `storage_path` is an honest
  "not available yet" state; `isServable()` gates every download.

## LMS

```text
courses ──*── course_sections ──*── lessons ──*── lesson_assets
   │                                   ├──1:1── quizzes ──*── quiz_questions ──*── quiz_options
   │                                   └──1:1── assignments ──*── assignment_submissions
   ├──*── course_instructors
   ├──*── enrollments ──*── lesson_progress
   │            ├──1:1── certificates
   │            └──*── quiz_attempts ──*── quiz_answers
   └──*── course_reviews (enrollment_id is NOT NULL)
```

**Invariants**

* `course_reviews.enrollment_id` is required, so a review cannot exist without
  the enrolment that verifies it.
* `lesson_progress` is unique per (enrolment, lesson); completion is idempotent.
* `enrollments.progress_percent` is derived by `ProgressService` from completed
  lessons — the client can only report seconds watched inside one lesson.
* `quiz_options.is_correct` is hidden from every student-facing payload.
* A certificate exists only for a completed enrolment and carries a public
  `verification_id`.

## Licensing and support

```text
software_licenses ──*── machine_bindings   (machine id encrypted + masked + hashed)
        └──*── activation_requests ──*── activation_request_events
refill_orders
support_tickets ──*── support_ticket_messages (is_internal)
contact_messages
settings
```

**Invariants**

* A Machine ID is stored three ways: encrypted (`machine_id_encrypted`), as a
  keyed hash for lookup (`machine_id_fingerprint`), and masked for display
  (`machine_id_masked`). Only the masked form is ever serialised.
* `activation_requests` requires an order the customer owns and a paid status.
* No table stores a signing key, token or recovery blob. That material lives in
  the offline vendor process — see
  [LICENSE_SERVICE_PHASE2_BN.md](LICENSE_SERVICE_PHASE2_BN.md).

## Migration order

Migrations are numbered by module so the dependency order is readable:

| Range | Module |
|---|---|
| `000100`-`000150` | roles, users, profiles, audit, idempotency, settings |
| `000200`-`000270` | media, authors, taxonomy, posts, pages, SEO, redirects |
| `000300`-`000360` | products, carts, coupons, orders, payments, downloads |
| `000400`-`000440` | courses, lessons, enrolments, quizzes, assignments |
| `000500`-`000510` | licences, activation, refills, support |
| `000520` | cross-module foreign keys (skipped on SQLite) |
