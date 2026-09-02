# Test report

Run on **3 September 2026** against the versions in
[DEPENDENCY_VERSIONS.md](DEPENDENCY_VERSIONS.md).

## Summary

| Suite | Result | Notes |
|---|---|---|
| Laravel unit + feature (PHPUnit) | **127 passed, 542 assertions** | Run in Docker on SQLite in memory |
| API contract test | **passed** | Every admin route is documented bar six declared exclusions |
| Frontend unit + component (Vitest) | **37 passed** | 6 files |
| End-to-end (Playwright), mock API | **57 passed** | 19 tests across desktop / tablet / mobile |
| End-to-end (Playwright), real Laravel API | **57 passed** | `--workers=1`; see "Running E2E against the real API" |
| TypeScript (`tsc --noEmit`) | **clean** | Web app and contracts package |
| ESLint | **clean** | 0 errors, 0 warnings |
| OpenAPI lint (Redocly) | **valid** | 23 style warnings, 0 errors |
| Production build (`next build`) | **succeeds** | 61 routes |

## Laravel suite

```text
PHPUnit 12.5.34 - OK (127 tests, 542 assertions)
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
| `SeedContentTest` | Every document in every seed file parses; the first one survives the file's leading comment; a malformed document throws rather than being skipped |
| `CourseEngagementTest` | A question is held for moderation and only its author sees it meanwhile; a non-enrolled visitor can neither read nor ask; publishing makes it visible to the class; notes are private to their writer and cannot be deleted by guessing an id; the gradebook reports an ungraded assignment as ungraded, not zero; wishlist add is idempotent; the course list exposes its track and the track filter rejects an unknown value |
| `CoursePrerequisiteTest` | A free enrolment is blocked until the prerequisite is completed; completing it clears the block; a purchase is never blocked, because the learner has already paid; reciprocal and self-referential prerequisites are refused |
| `ApiContractTest` | Every route the router knows is documented in the OpenAPI spec, bar six declared exclusions |
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

## Running E2E against the real API

The Playwright suite defaults to the Node mock API, which is concurrent and is
what CI uses. `infra/scripts/dev-api.sh` serves the real Laravel app instead, but
`artisan serve` handles one request at a time, so the suite must be run with
`--workers=1` against it:

```bash
E2E_BASE_URL=http://127.0.0.1:3200 npx playwright test --workers=1
```

Run in parallel against that server, six tests fail on timeouts as the workers
queue behind PHP. That is a limitation of the development server, not of the
application: the same tests pass serially against the real API and in parallel
against the mock.

## Defects found and fixed in this round

| What | How it was found |
|---|---|
| The seed-content parser silently dropped the first document of every file, because the explanatory comment at the top broke the front-matter match. The first article, the first course and the first lesson of each file had never been seeded. | Seeded counts did not match what had been written; now covered by `SeedContentTest`, and a malformed document throws instead of being skipped |
| The course list returned no `track`, so the whole catalogue rendered the fallback artwork. `track` had been added to `CourseResource` but not to `CourseSummaryResource`, which is what the list actually returns. | Visual check of the rendered catalogue; now covered by `CourseEngagementTest` |
| The sitemap skipped CMS pages outright, so any page the owner published that was not also hard-coded in the static list never reached it. | Reading the sitemap builder while adding the feed |
| The product page claimed "AutoCAD 2024-2027" with a version-specific runtime. That came from the name of a build folder, not from anything the owner had written; their own product document says the current build is prepared for AutoCAD 2024. | Reading the owner's product PDF against the page |
