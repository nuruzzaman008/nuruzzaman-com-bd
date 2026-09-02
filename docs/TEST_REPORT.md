# Test report

Run on **2 September 2026** against the versions in
[DEPENDENCY_VERSIONS.md](DEPENDENCY_VERSIONS.md).

## Summary

| Suite | Result | Notes |
|---|---|---|
| Laravel unit + feature (PHPUnit) | **99 passed, 292 assertions** | Run in Docker on SQLite in memory |
| API contract test | **not executed** | Added after Docker Desktop stopped — see "Known gap" |
| Frontend unit + component (Vitest) | **37 passed** | 6 files |
| End-to-end (Playwright) | **57 passed** | 19 tests across desktop / tablet / mobile |
| TypeScript (`tsc --noEmit`) | **clean** | Web app and contracts package |
| ESLint | **clean** | 0 errors, 0 warnings |
| OpenAPI lint (Redocly) | **valid** | 23 style warnings, 0 errors |
| Production build (`next build`) | **succeeds** | 58 routes, 57 prerendered pages |

## Laravel suite

```text
PHPUnit 12.5.34 - OK (99 tests, 292 assertions)
```

| Area | What is covered |
|---|---|
| `MoneyTest` | Minor-unit arithmetic, half-up percentage rounding, currency mixing refused |
| `MachineIdentifierTest` | Masking keeps only the first and last four characters; normalisation |
| `AuthTest` | Registration assigns the customer role; terms required; suspended accounts refused; forgot-password cannot enumerate accounts; account routes need a session |
| `AuthorizationMatrixTest` | Every admin endpoint against every role; editors publish but instructors cannot edit others' drafts; a super admin cannot change their own roles; role sync needs password confirmation; unverified staff refused |
| `CartPricingTest` | Totals from stored prices; a variant with no published price is not purchasable; percentage coupons; expired coupons refused; tax only once configured; anonymous cart merges on sign-in |
| `CheckoutTest` | Server-side pricing; a browser-sent total is ignored; every policy acceptance required; empty cart refused; idempotency replay and conflict |
| `PaymentValidationTest` | Valid IPN settles and queues fulfilment; tampered amount and mismatched currency rejected; duplicate IPN stored and processed once; failed callback fails the order; a late failure cannot undo a settled payment; risky payments held; unknown reference recorded and ignored; the return URL settles nothing; one customer cannot read another's payment |
| `FulfillmentTest` | Course orders create enrolment and invoice; software orders issue a licence and a download entitlement with the pivot's limits; fulfilment is safe to run twice; an unpaid order is never fulfilled |
| `DownloadEntitlementTest` | Entitled download succeeds and is counted; no entitlement, revoked, expired and limit-reached all refused and logged; an asset with no stored file is unavailable; the private path is never serialised |
| `LearningTest` | Free preview is public; a paid lesson is not reachable through the preview route; no enrolment means no access; sequential locking; progress derived server-side and completion idempotent; heartbeat clamped to the lesson duration and never moves backwards; a revoked enrolment loses access |
| `QuizTest` | Correctness never leaves the server; a correct submission passes and completes the lesson; a wrong one does not; attempt limit enforced; one learner cannot submit another's attempt |
| `ActivationRequestTest` | Ownership enforced; Machine ID stored encrypted and only ever returned masked; someone else's order refused; unpaid order refused; duplicate open request is a conflict; a recovery-file field is ignored; only support staff can review; illegal status jumps refused |
| `RefundTest` | Refund is request-then-approve; cannot exceed the remaining total; processing revokes entitlements; a rejected refund returns the order to its previous state; support staff cannot request refunds |
| `ContentWorkflowTest` | Publishing asks the frontend to revalidate; illegal status jumps refused; scheduling requires a date; edits snapshot a restorable revision; the scheduler publishes what is due; a course with no lessons cannot be published |
| `PublicContentTest` | Only published posts are listed; drafts 404; raw HTML stripped from Markdown; a course with no lessons is never listed; legal pages report they are awaiting review; the sitemap feed excludes drafts; unconfigured settings stay null; search covers published records only |

## Frontend suite

```text
Vitest 3.2.7 - 37 passed (6 files)
```

* `format.test.ts` — a null price stays null rather than becoming zero; UTC is
  rendered in Asia/Dhaka; ISO output stays unlocalised; durations, file sizes and
  Bangla numerals.
* `seo.test.ts` — CMS SEO overrides win; noindex is honoured; private pages are
  never indexable; JSON-LD escapes a closing tag; breadcrumb positions start at
  one; **no Offer without a published price**; **no aggregateRating without real
  reviews**; a reviewer is recorded when one exists.
* `robots-sitemap.test.ts` — every private surface is disallowed; the sitemap
  lists published content, excludes private routes, and does not duplicate CMS
  pages.
* `revalidate-route.test.ts` — a correctly signed request revalidates; a wrong
  secret and a missing signature are rejected; malformed tags are dropped; empty
  and oversized tag lists refused.
* `price-tag.test.tsx` — an unpublished price renders an honest fallback with no
  zero anywhere; a discount is marked with a word, not colour alone.
* `form.test.tsx` — label, hint and error are wired to the control; required is
  announced, not just asterisked; the error summary shows one message per field.

## End-to-end

```text
Playwright 1.62.1 - 57 passed (desktop 1440, tablet 768, mobile Pixel 5)
```

Covered: the home page and primary navigation; reaching an article from the blog
index; BlogPosting structured data matching the visible heading; a product with
no published price never showing a zero; the legal draft notice; the skip link
being the first focusable control; an axe scan with zero WCAG 2.1 AA violations;
`robots.txt` and `sitemap.xml` policy; every private route redirecting a
signed-out visitor; checkout marked noindex; a failed sign-in staying on the page
with an announced error; no horizontal overflow at 360/768/1440; the mobile menu
opening and closing with the keyboard.

All three projects run on Chromium so the suite needs one browser download.
Adding WebKit or Firefox is a one-line change in `playwright.config.ts` once
those engines are installed.

### Defects this suite found, and the fixes

1. **Colour contrast.** The teal used for 12px section labels was 4.04:1 on
   white and 4.42:1 on the pale blue ground — below the WCAG AA 4.5:1 threshold
   for normal text. Darkened to `#00707a`, which measures 5.84:1 on white,
   5.07:1 on `--color-blue-soft` and 5.14:1 on `--color-teal-soft`.
2. **Horizontal overflow at 360px.** The header wordmark pushed the actions 25px
   past the viewport. The wordmark is now hidden below 400px and the action group
   no longer shrinks.
3. **Two links with no accessible name.** Hiding the wordmark and the account
   label below the `sm` breakpoint left both links with only `aria-hidden`
   content, so a screen reader announced nothing. Both now carry a
   visually-hidden name.

## Known gap

Docker Desktop stopped part-way through this session and could not be brought
back: the process starts but its WSL engine stays stopped, apparently waiting on
a UI prompt. The Laravel suite was green (99 tests, 292 assertions) before that;
three additional tests in `ApiContractTest` were written afterwards and **have
not been run**.

Their logic was verified another way: a script compared every route in
`routes/api*.php` against the bundled `openapi.json` in both directions. All 87
admin routes and the whole public, account and learn surface are documented, and
the only undocumented routes are the six the test lists as deliberate
exclusions. Run this before relying on it:

```bash
npm run api:test -- --filter=ApiContractTest
```

Four files changed after the last green backend run: `PostResource.php` and
`PageResource.php` (each gained `id`, `status` and a permission-gated
`body_markdown`), the new `ApiContractTest.php`, and `routes/api_admin.php`
(route parameters renamed to bind on `id`). Re-run the whole backend suite, not
just the contract test, once Docker is available:

```bash
npm run api:test
```

## Not yet run

| Check | Why | How to run |
|---|---|---|
| Lighthouse | Needs a production deployment | `npx lighthouse https://… --preset=desktop` |
| Load / soak | Needs staging with realistic data | — |
| Live SSLCOMMERZ | Needs merchant credentials | The sandbox path is fully covered by `PaymentValidationTest` |
| Restore drill | Needs a real backup | [BACKUP_RESTORE_BN.md](BACKUP_RESTORE_BN.md) |
| Manual screen-reader pass | Automated axe is not a substitute | NVDA + Firefox, VoiceOver + Safari |

## Reproducing

```bash
npm install
npm run contracts:types

# Frontend
npm run typecheck && npm run lint && npm run test

# End-to-end (starts a mock API and a production build itself)
npm run test:e2e

# Backend (needs Docker)
npm run api:test
```
