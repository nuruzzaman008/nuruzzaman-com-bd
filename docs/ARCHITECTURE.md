# Architecture

## Why two applications

Next.js can be a full-stack framework on its own. This project splits the work
because the domain has parts that want a mature server runtime: payment ledgers,
order transactions, entitlement checks, background jobs, an audit trail, and a
future licence service that must stay isolated.

| Concern | Owner |
|---|---|
| Public pages, SEO rendering, storefront, course player, account and admin UI | Next.js |
| Authentication, authorisation, validation, transactions, payment, orders, enrolment, progress, download entitlement, queued email, audit log | Laravel |
| Authoritative persistent data | MySQL |
| Session, cache, rate limiting, queue | Redis (MySQL fallback) |

They are one product, not two: a single repository, a single deployment
pipeline, and a single public origin.

## Request routing

```text
Browser
  |
  v
Cloudflare (CDN / WAF)
  |
  v
Nginx  --- /api/*, /sanctum/*, /storage/*, /up ---> Laravel (PHP-FPM)
       --- everything else                      ---> Next.js (Node)
```

Because the browser only ever talks to one origin:

* the Sanctum session cookie stays first-party,
* CORS is not needed in production (it is configured only for local dev, where
  Next runs on its own port),
* payment callbacks and the app share a hostname, which SSLCOMMERZ requires.

Server Components do **not** go back out through the public origin. They call
Laravel directly over the internal network via `INTERNAL_API_URL`, so a page
render costs one internal hop rather than a public round trip.

## Rendering strategy

| Surface | Strategy | Why |
|---|---|---|
| Home, blog, topics, courses, shop, support, legal | Cached fetches with tags, prerendered where possible | Cheap, fast, revalidated on publish |
| Cart, checkout, account, dashboard, course player | Dynamic, `no-store`, `Cache-Control: private` | Per-visitor data must never enter a shared cache |
| `sitemap.xml`, `robots.txt` | Cached route handlers | Regenerated on a publish |

Cache invalidation is push-based. When content is published, Laravel dispatches
`RevalidateFrontend`, which posts an HMAC-signed list of tags to
`/api/revalidate` in Next.js. The route verifies the signature, validates the tag
shape, and calls `revalidateTag(tag, 'max')` — readers keep seeing the previous
page while the new one is generated.

```text
Editor publishes -> PublishingService -> RevalidateFrontend job
                                            |
                                    HMAC-signed POST
                                            v
                              Next.js /api/revalidate -> revalidateTag()
```

## Authentication

Laravel Sanctum in its first-party, stateful mode:

1. The browser calls `GET /sanctum/csrf-cookie` once.
2. `POST /api/v1/auth/login` sets an HttpOnly, SameSite session cookie.
3. Every mutating request echoes the `XSRF-TOKEN` cookie back in the
   `X-XSRF-TOKEN` header.

No JWT, no token in `localStorage` — the shared ESLint config makes
`localStorage` an error so it cannot creep back in.

`src/proxy.ts` (Next.js 16's replacement for `middleware.ts`) redirects a visitor
with no session cookie away from `/account`, `/dashboard`, `/learn` and
`/checkout`. That is a UX shortcut, not a security boundary: the API authorises
every read and write through policies at the data source.

## Domain services

Business rules live in services, not controllers:

| Service | Rule it owns |
|---|---|
| `PricingService` | The only place a cart total is computed |
| `OrderStateMachine` | The only place an order status changes |
| `PaymentProcessor` | Validates every gateway callback, stores it once by fingerprint, settles at most once |
| `FulfillmentService` | Grants entitlements idempotently |
| `RevocationService` | Withdraws them on refund |
| `EnrollmentService` | Access, drip and sequential rules |
| `ProgressService` | Derives progress on the server |
| `QuizService` | Grades on the server; option correctness never leaves it |
| `ActivationService` | Phase 1 licence workflow, with the Machine ID encrypted |
| `PublishingService` | Editorial workflow, revisions and cache invalidation |

## Contract

`packages/contracts/openapi.yaml` is the source of truth for the HTTP surface.
`npm run contracts:types` regenerates `src/generated/api.ts` and a bundled
`openapi.json`. A Laravel feature test (`ApiContractTest`) asserts that every
documented operation exists in the router and that every route is either
documented or listed as a deliberate exclusion, so the two cannot drift.

## Data flow: a purchase

```text
Add to cart      -> server cart, priced from the prices table
Checkout         -> CheckoutService recalculates totals, snapshots the order,
                    OrderStateMachine moves draft -> pending_payment
Gateway session  -> SslCommerzGateway sends the stored amount
Hosted page      -> customer pays on SSLCOMMERZ; no card data reaches us
IPN              -> PaymentProcessor validates against the Order Validation API,
                    checks tran_id, amount, currency, status and risk flag
Settlement       -> order -> paid, FulfillOrder queued after commit
Fulfilment       -> entitlements, enrolments, licence, invoice, receipt email
```

A customer landing on the success URL changes nothing; the result page polls a
read-only status endpoint and shows a "confirming" state until a validated
callback arrives. `ReconcilePayments` runs every fifteen minutes as a safety net
for a lost IPN.
