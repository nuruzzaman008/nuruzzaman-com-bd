# Dependency versions

Tested on **2 September 2026**. Lockfiles (`package-lock.json`,
`apps/api/composer.lock`) are committed, so an install reproduces exactly these
versions.

## Runtime

| Component | Version | Notes |
|---|---|---|
| Node.js | 24.19.0 | Next.js 16 requires ≥ 20.9 |
| PHP | 8.4 (image) / 8.5 (test container) | Laravel 13 requires ≥ 8.3 |
| MySQL | 8.4 | InnoDB, strict mode, `utf8mb4` |
| Redis | 7 | Optional; MySQL drivers are the documented fallback |
| Nginx | 1.27 | Reverse proxy and TLS termination |

## Frontend

| Package | Version | Why this one |
|---|---|---|
| `next` | 16.3.4 | Turbopack is the default bundler; `middleware.ts` is now `proxy.ts`; request APIs are async |
| `react` / `react-dom` | 19.2.8 | Ships with the App Router |
| `tailwindcss` | 4.3.3 | CSS-first config via `@theme`; zero-runtime output |
| `@tailwindcss/postcss` | 4.3.3 | Official PostCSS integration |
| `typescript` | 5.9.3 | Strict mode across the repo |
| `eslint` | 9.39.5 | Flat config; `next lint` was removed in Next 16 |
| `eslint-config-next` | 16.3.4 | Core Web Vitals + TypeScript rules |
| `vitest` | 3.2.7 | Unit and component tests |
| `@testing-library/react` | 16.3.3 | Accessibility-first queries |
| `jsdom` | 26.1.0 | DOM for component tests |
| `@playwright/test` | 1.62.1 | End-to-end across three viewports |
| `@axe-core/playwright` | 4.13.0 | Automated WCAG checks inside the E2E run |

## Contracts

| Package | Version | Why |
|---|---|---|
| `openapi-typescript` | 7.13.0 | Generates types from `openapi.yaml` |
| `@redocly/cli` | 1.34.19 | Lints the spec and bundles it to JSON for the PHP contract test |

## Backend

| Package | Version | Why |
|---|---|---|
| `laravel/framework` | 13.30.1 | Current stable |
| `laravel/sanctum` | 4.3.3 | First-party cookie session auth |
| `predis/predis` | 3.6.0 | Pure-PHP Redis client; no `phpredis` extension needed |
| `league/flysystem-aws-s3-v3` | 3.35.3 | S3-compatible private storage |
| `guzzlehttp/guzzle` | 8.1.0 | HTTP client behind Laravel's `Http` facade |
| `phpunit/phpunit` | 12.5.34 | Test runner |

## Deliberately not used

| Not used | Instead |
|---|---|
| WordPress, WooCommerce, Tutor LMS, Elementor | Custom code throughout |
| Filament or any paid admin package | Custom `/dashboard` in Next.js |
| A PDF library for certificates and invoices | Self-contained HTML on the private disk; a converter can be pointed at it later without a data-model change |
| An HTML sanitiser package | Markdown is rendered with `html_input: strip`, so raw HTML never enters the pipeline |
| A YAML parser for PHP | The spec is bundled to JSON by Redocly and read with `json_decode` |
| Any runtime CSS-in-JS | Tailwind emits static CSS |

## Security notes

* `npm audit` at the time of writing reports advisories only in transitive
  development dependencies of the Redocly CLI; nothing in the runtime path.
  Re-check before each release.
* `composer audit` reports no advisories.
* Renew this file whenever a major version moves, and note what had to change.

## Upgrade notes

* **Next.js 16** — Turbopack is default for `dev` and `build`; `middleware.ts`
  must be `proxy.ts` with a `proxy` export; `params`, `searchParams`, `cookies()`
  and `headers()` are Promises; `revalidateTag` takes a cache-life profile as a
  second argument; `next lint` is gone.
* **Tailwind v4** — no `tailwind.config.js`; tokens live in `@theme` inside
  `globals.css`.
* **Laravel 13** — models may declare `#[Fillable]`/`#[Hidden]` attributes; the
  classic `protected $fillable` used here still works and is kept for clarity.
