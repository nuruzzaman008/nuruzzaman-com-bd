/**
 * A tiny stand-in for the Laravel API.
 *
 * It exists so the frontend can be built, previewed and tested without the PHP
 * stack running - useful for frontend-only work and for a CI smoke build. It is
 * never used in production: `next start` talks to the real API through
 * INTERNAL_API_URL.
 *
 * Usage: node tools/mock-api.mjs [port]
 */
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 8001);

const site = {
  name: 'Engr. Md. Nuruzzaman, RSE',
  url: 'https://nuruzzaman.com.bd',
  locale: 'bn_BD',
  timezone: 'Asia/Dhaka',
  currency: 'BDT',
  support_email: null,
  support_hours: null,
  phone: null,
  business_address: null,
  legal_entity: null,
  legal_reviewed: false,
  product: {
    designed_for: 'AutoCAD 2024-2027',
    tested_autocad_versions: null,
    installer_sha256: null,
    code_signing_status: 'unknown',
  },
  analytics: { ga4_id: null, search_console_verification: null },
  overrides: {},
};

const author = {
  slug: 'nuruzzaman',
  name: 'Engr. Md. Nuruzzaman',
  credentials: 'RSE',
  headline: 'Structural engineer and AutoCAD automation developer.',
  bio: null,
  same_as: [],
  is_reviewer: true,
};

const categories = [
  { slug: 'rcc-design-detailing', name: 'RCC ডিজাইন ও ডিটেইলিং', description: null, posts_count: 2 },
  { slug: 'autocad-productivity', name: 'AutoCAD প্রোডাক্টিভিটি', description: null, posts_count: 1 },
];

const postSummary = {
  slug: 'isolated-footing-size-check-bangla',
  title: 'আইসোলেটেড ফুটিংয়ের সাইজ যাচাই',
  excerpt: 'Allowable bearing capacity থেকে প্রাথমিক সাইজ বের করার ধাপে ধাপে হিসাব।',
  reading_minutes: 6,
  published_at: '2026-08-12T06:00:00Z',
  updated_at: '2026-08-12T06:00:00Z',
  author,
  categories,
};

const post = {
  ...postSummary,
  id: 1,
  status: 'published',
  body_html: '<h2>সরাসরি উত্তর</h2><p>Service load কে allowable bearing capacity দিয়ে ভাগ করুন।</p>',
  body_markdown: '## সরাসরি উত্তর\n\nService load কে allowable bearing capacity দিয়ে ভাগ করুন।',
  toc: [{ level: 2, text: 'সরাসরি উত্তর', id: 'answer' }],
  funnel_stage: 'awareness',
  reviewed_at: '2026-08-11T06:00:00Z',
  reviewer: author,
  tags: [],
  seo: {
    meta_title: null,
    meta_description: null,
    canonical_url: null,
    noindex: false,
    nofollow: false,
  },
};

const page = {
  id: 1,
  status: 'published',
  slug: 'about',
  title: 'পরিচিতি',
  body_html: '<h2>কী নিয়ে এই সাইট</h2><p>প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং শিক্ষা ও টুলস।</p>',
  body_markdown: '## কী নিয়ে এই সাইট',
  toc: [{ level: 2, text: 'কী নিয়ে এই সাইট', id: 'intro' }],
  template: 'default',
  awaiting_legal_review: false,
  legal_reviewer: null,
  legal_reviewed_at: null,
  published_at: '2026-08-01T06:00:00Z',
  updated_at: '2026-08-01T06:00:00Z',
  seo: { meta_title: null, meta_description: null, canonical_url: null, noindex: false, nofollow: false },
};

const legalPage = {
  ...page,
  slug: 'terms',
  title: 'ব্যবহারের শর্তাবলি',
  template: 'legal',
  awaiting_legal_review: true,
};

const variant = {
  id: 1,
  sku: 'NBET-V6-SINGLE',
  name: 'Single machine licence',
  description: null,
  credit_amount: null,
  license_term_days: null,
  device_limit: 1,
  access_duration_days: null,
  price: null,
  is_purchasable: false,
};

const product = {
  slug: 'nb-engineering-tools',
  type: 'software_license',
  name: 'NB Engineering Tools v6.0',
  tagline: 'Structural & Engineering Design Tools for AutoCAD',
  description_html: '<p>AutoCAD 2024-2027-এর জন্য one-setup architecture।</p>',
  feature_groups: ['Layout, Grid & Schedule', 'Footing & Foundation'],
  specs: { platform: 'Windows 10 / 11, 64-bit' },
  variants: [variant],
  published_at: '2026-08-01T06:00:00Z',
  seo: { meta_title: null, meta_description: null, canonical_url: null, noindex: false, nofollow: false },
};

const productSummary = {
  slug: product.slug,
  type: product.type,
  name: product.name,
  tagline: product.tagline,
  from_price: null,
  variant_count: 1,
};

const release = {
  slug: 'nb-engineering-tools-v6',
  name: 'NB Engineering Tools v6.0 Installer',
  version: '6.0',
  size_bytes: null,
  checksum_sha256: null,
  code_signing_status: 'unknown',
  test_status: 'untested',
  release_notes_html: '<p>২৬টি compiled VLX application।</p>',
  released_at: null,
  is_available: false,
};

const emptyCart = {
  token: 'mock-cart-token',
  status: 'open',
  currency: 'BDT',
  subtotal_minor: 0,
  discount_minor: 0,
  tax_minor: 0,
  total_minor: 0,
  coupon_code: null,
  coupon_error: null,
  is_purchasable: false,
  blockers: [],
  lines: [],
};

/** Exact-path fixtures. */
const ROUTES = new Map([
  ['/api/v1/site/settings', { data: site }],
  ['/api/v1/site/sitemap', { data: { posts: [{ slug: post.slug, updated_at: post.updated_at }], pages: [], products: [], courses: [] } }],
  ['/api/v1/site/redirects', { data: [] }],
  ['/api/v1/posts', { data: [postSummary], meta: { current_page: 1, last_page: 1, per_page: 12, total: 1 } }],
  ['/api/v1/categories', { data: categories }],
  ['/api/v1/authors', { data: [author] }],
  ['/api/v1/products', { data: [productSummary], meta: { current_page: 1, last_page: 1, per_page: 24, total: 1 } }],
  ['/api/v1/courses', { data: [], meta: { current_page: 1, last_page: 1, per_page: 12, total: 0 } }],
  ['/api/v1/releases', { data: [release] }],
  ['/api/v1/cart', { data: emptyCart }],
]);

/** Pattern fixtures, tried in order. */
const PATTERNS = [
  [/^\/api\/v1\/posts\/[^/]+\/related$/, { data: [] }],
  [/^\/api\/v1\/posts\/[^/]+$/, { data: post }],
  [/^\/api\/v1\/categories\/[^/]+$/, { data: categories[0] }],
  [/^\/api\/v1\/authors\/[^/]+$/, { data: author }],
  [/^\/api\/v1\/pages\/(terms|privacy-policy|refund-policy|software-eula|course-terms|engineering-disclaimer)$/, { data: legalPage }],
  [/^\/api\/v1\/pages\/[^/]+$/, { data: page }],
  [/^\/api\/v1\/products\/[^/]+$/, { data: product }],
  [/^\/api\/v1\/releases\/[^/]+$/, { data: release }],
  [/^\/api\/v1\/verify\/[^/]+$/, { data: { valid: false, reason: 'not_found' } }, 404],
  [/^\/api\/v1\/search$/, { data: { query: '', posts: [], courses: [], products: [] } }],
];

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const pathname = url.pathname;

  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Anything that needs a session answers 401, which is what a signed-out
  // visitor sees against the real API.
  if (
    pathname.startsWith('/api/v1/me') ||
    pathname.startsWith('/api/v1/account') ||
    pathname.startsWith('/api/v1/admin') ||
    pathname.startsWith('/api/v1/learn')
  ) {
    response.statusCode = 401;
    response.end(
      JSON.stringify({ error: { code: 'unauthenticated', message: 'Authentication is required.' } }),
    );

    return;
  }

  const exact = ROUTES.get(pathname);

  if (exact) {
    response.end(JSON.stringify(exact));

    return;
  }

  for (const [pattern, body, status] of PATTERNS) {
    if (pattern.test(pathname)) {
      response.statusCode = status ?? 200;
      response.end(JSON.stringify(body));

      return;
    }
  }

  response.statusCode = 404;
  response.end(
    JSON.stringify({ error: { code: 'not_found', message: 'The requested resource was not found.' } }),
  );
});

server.listen(port, () => {
  process.stdout.write(`mock API listening on http://127.0.0.1:${port}\n`);
});
