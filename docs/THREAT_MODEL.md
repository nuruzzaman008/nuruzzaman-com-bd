# Threat model

Scope: the public site, the API, the admin surface and the payment path. The
offline vendor licence process is out of scope and is deliberately not reachable
from here.

Each row lists the threat, what stops it, and where to look in the code.

## Account and session

| Threat | Control | Where |
|---|---|---|
| Credential stuffing | Rate limit of 5/min per IP **and** per email; identical failure message either way | `AppServiceProvider::configureRateLimiting`, `LoginController` |
| Account enumeration via password reset | The forgot-password endpoint always returns the same body | `PasswordController::forgot`, asserted in `AuthTest` |
| Session theft via XSS | Session is an HttpOnly, SameSite cookie; no token in JS; `localStorage` is an ESLint error | `config/session.php`, `packages/eslint-config` |
| CSRF | Sanctum stateful middleware + `X-XSRF-TOKEN` on every mutation | `bootstrap/app.php`, `lib/api/browser.ts` |
| Privilege escalation via self-assignment | Role sync requires super admin, refuses the acting user, and needs a recent password confirmation | `UserPolicy::assignRoles`, `password.confirm` middleware |
| A suspended account keeping access | `active` middleware rejects every authenticated route | `EnsureUserIsActive` |
| Stale sessions on a lost device | Device list and revoke (database session driver) | `SessionDeviceController` |

## Payment

| Threat | Control | Where |
|---|---|---|
| Price tampering | Totals recalculated server-side from the `prices` table; the request body cannot influence them | `PricingService`, `CheckoutService`, asserted in `CheckoutTest` |
| Forged "payment succeeded" | Only a callback verified against the gateway's Order Validation API can settle an order; the return URL settles nothing | `PaymentProcessor`, `SslCommerzGateway::validateTransaction` |
| Replayed or duplicated IPN | Unique fingerprint per callback; stored once, processed once | `payment_events.fingerprint`, asserted in `PaymentValidationTest` |
| Out-of-order callbacks | A settled payment is never downgraded by a later failure | `PaymentProcessor::recordFailure` |
| Amount or currency mismatch | Compared in minor units against the stored order before acceptance | `SslCommerzGateway::validateTransaction` |
| Double order from a double submit | `Idempotency-Key` middleware replays the stored response | `EnforceIdempotency` |
| Fraudulent orders | Gateway risk flag puts the payment on `risk_hold` and blocks fulfilment by default | `NB_RISK_ORDER_POLICY` |
| Lost IPN leaving a paid order unfulfilled | Reconciliation job every 15 minutes | `ReconcilePayments` |
| Secret leakage | Store id and password only in the Laravel environment; never `NEXT_PUBLIC_`, never in Git | `config/sslcommerz.php`, `.gitignore` |

## Entitlements and downloads

| Threat | Control | Where |
|---|---|---|
| Downloading without buying | Entitlement row required; checked on every request | `DownloadService::authorize` |
| Path traversal / arbitrary file read | The path comes from the database by slug, never from input | `DownloadController`, `DownloadAsset` |
| Installer exposed publicly | Private disk only; Nginx serves just `storage/app/public` | `config/filesystems.php`, `infra/nginx` |
| Link sharing | Signed URLs expire in minutes; download counts and expiry are enforced; every attempt is logged | `DownloadService`, `download_events` |
| Access surviving a refund | `RevocationService` withdraws downloads, enrolments and licences | asserted in `RefundTest` |
| IDOR on orders, requests, tickets | Policies compare `user_id` at the data source | `OrderPolicy`, `ActivationRequestPolicy`, `SupportTicketPolicy` |

## Learning

| Threat | Control | Where |
|---|---|---|
| Progress or certificate manipulation | Progress derived server-side from completed lessons; the client may only report seconds within one lesson, clamped and monotonic | `ProgressService`, asserted in `LearningTest` |
| Reading a locked lesson | Enrolment, drip window and sequential rule checked server-side | `EnrollmentService::assertAccess` |
| Cheating a quiz | Option correctness never leaves the server; grading is server-side; attempts are capped | `QuizService`, `QuizOption::$hidden` |
| Fake reviews | A review row cannot exist without the enrolment that verifies it, and is moderated before publication | `course_reviews.enrollment_id`, `ReviewModerationController` |
| Private video URL leaking | Only a provider id is stored; a short-lived descriptor is minted per request | `VideoPlaybackService`, `Lesson::$hidden` |

## Content and admin

| Threat | Control | Where |
|---|---|---|
| Stored XSS through Markdown | Raw HTML is stripped at render, unsafe links dropped | `App\Support\Markdown`, asserted in `PublicContentTest` |
| XSS through JSON-LD | `<` escaped before it reaches the script tag | `lib/seo.ts`, asserted in `seo.test.ts` |
| Malicious upload | MIME type, extension and size validated; stored under a generated name | `MediaController`, `AssignmentController` |
| Open redirect | Redirect source and destination must both be site-relative paths | `Admin\RedirectController` |
| Cache poisoning via the revalidation webhook | HMAC signature verified; tag shape validated; count capped | `app/api/revalidate/route.ts`, asserted in `revalidate-route.test.ts` |
| Unauthorised publishing | `posts.publish` is a separate permission from `posts.update` | `PostPolicy`, asserted in `AuthorizationMatrixTest` |
| Silent admin action | Every sensitive action writes an audit row with secrets redacted | `App\Support\Audit` |

## Privacy

| Threat | Control | Where |
|---|---|---|
| Machine ID exposure | Encrypted at rest, looked up by keyed hash, only ever rendered masked | `MachineIdentifier`, asserted in `ActivationRequestTest` |
| Card data exposure | No card data reaches this system; payment happens on the gateway's page | — |
| Secrets in logs | `Audit::redact` strips passwords, tokens, store credentials and machine ids | `App\Support\Audit` |
| Personal data in URLs | Identifiers are opaque references; nothing personal is placed in a query string | route design |

## Supply chain and operations

| Threat | Control |
|---|---|
| Compromised dependency | Pinned lockfiles; `npm audit` and `composer audit` in the release checklist |
| Secret committed | `.gitignore` covers `.env*`, `*.pem`, `*.pfx`, `*.key`; secret scan in the launch checklist |
| Debug output in production | `APP_DEBUG=false` is a launch gate; the API never returns a stack trace otherwise |
| Data loss | Off-site encrypted MySQL backups plus a restore drill |

## Known limitations

These are documented rather than hidden:

* **Admin MFA is modelled but not enforced.** The `users` table carries an
  encrypted `mfa_secret` and `mfa_confirmed_at`, and the launch checklist makes
  MFA a gate, but the enrolment flow is not built yet.
* **Device listing needs the database session driver.** With Redis sessions the
  endpoint honestly reports that the feature is unavailable rather than showing
  an incomplete list.
* **CSP allows `unsafe-inline` for styles and scripts.** Next.js inlines both;
  tightening this needs nonce plumbing and should be rolled out in report-only
  mode first.
* **No WAF rules are shipped.** Cloudflare or equivalent is assumed in front.
