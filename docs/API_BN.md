# API গাইড

সম্পূর্ণ চুক্তি: [`packages/contracts/openapi.yaml`](../packages/contracts/openapi.yaml)।
সেখান থেকেই TypeScript টাইপ ও ক্লায়েন্ট তৈরি হয় (`npm run contracts:types`), এবং
একটি Laravel টেস্ট নিশ্চিত করে যে স্পেক ও রাউটার আলাদা হয়ে যেতে পারে না।

বেস পাথ: `/api/v1`

## অথেনটিকেশন

Sanctum-এর first-party cookie সেশন — কোনো bearer token নেই, `localStorage`-এ
কিছু রাখা হয় না।

```text
1. GET  /sanctum/csrf-cookie          একবার, XSRF-TOKEN কুকি পেতে
2. POST /api/v1/auth/login            সেশন কুকি সেট হয়
3. প্রতিটি mutation-এ  X-XSRF-TOKEN: <কুকির মান>
```

ব্রাউজার থেকে প্রতিটি অনুরোধে `credentials: 'include'` লাগে —
`packages/contracts`-এর ক্লায়েন্ট এটি নিজেই করে।

## এরর ফরম্যাট

প্রতিটি ব্যর্থতা একই খামে আসে, তাই ক্লায়েন্টে একটিই হ্যান্ডলার লাগে:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The submitted data is not valid.",
    "fields": { "email": ["The email field is required."] },
    "request_id": "0f0c…"
  }
}
```

| code | HTTP | কখন |
|---|---|---|
| `validation_failed` | 422 | ফিল্ড ভ্যালিডেশন |
| `unauthenticated` | 401 | সেশন নেই |
| `forbidden` | 403 | সেশন আছে, অনুমতি নেই |
| `not_found` | 404 | নেই, অথবা প্রকাশিত নয় |
| `conflict` | 409 | অবৈধ অবস্থা পরিবর্তন, বা idempotency দ্বন্দ্ব |
| `locked` | 423 | পাসওয়ার্ড নিশ্চিতকরণ দরকার |
| `rate_limited` | 429 | রেট লিমিট |
| `server_error` | 500 | অপ্রত্যাশিত |

`request_id` রেসপন্স হেডারেও (`X-Request-Id`) থাকে এবং সার্ভার লগ ও অডিট সারিতে
একই মান ব্যবহার হয় — সাপোর্টে এটি দিলে ঘটনাটি খুঁজে বের করা যায়।

## নিয়ম

- **টাকা** সবসময় পূর্ণসংখ্যা minor unit (`amount_minor`)। `price: null` মানে দাম
  প্রকাশ করা হয়নি — শূন্য নয়।
- **সময়** UTC-তে ISO-8601; দেখানোর সময় Asia/Dhaka-তে রূপান্তর করতে হয়।
- **Markdown** সার্ভারে রেন্ডার হয়ে `*_html` হিসেবে আসে, raw HTML বাদ দিয়ে।
  ফ্রন্টএন্ডে আলাদা sanitizer লাগে না।
- **Machine ID** সবসময় masked।

## রেট লিমিট

| গোষ্ঠী | সীমা |
|---|---|
| `auth` | ৫/মিনিট (IP ও ইমেইল — দুটোতেই) |
| `api` | ১২০/মিনিট |
| `checkout` | ১০/মিনিট |
| `downloads` | ১৫/মিনিট |
| `activation` | ১০/ঘণ্টা |
| `progress` | ১২০/মিনিট |
| `public-forms` | ২০/ঘণ্টা |
| `search` | ৩০/মিনিট |
| `ipn` | ৬০/মিনিট |

## Idempotency

`POST /checkout` এবং রিফান্ড অনুমোদনে `Idempotency-Key` হেডার পাঠানো যায়
(৮–১২৮ অক্ষর)। একই key + একই body → আগের রেসপন্স (`Idempotency-Replayed: true`);
একই key + ভিন্ন body → ৪০৯।

## পেজিনেশন

তালিকা endpoint-গুলো Laravel-এর স্ট্যান্ডার্ড খাম দেয়:

```json
{ "data": [], "links": {}, "meta": { "current_page": 1, "last_page": 3 } }
```

`page` ও `per_page` query প্যারামিটার সমর্থিত। ফিল্টার ও সর্ট allowlist-ভিত্তিক —
অজানা মান নীরবে উপেক্ষা করা হয় না, ভ্যালিডেশন এরর দেয়।

## সারফেস

| গোষ্ঠী | উদাহরণ |
|---|---|
| Site | `/site/settings`, `/site/sitemap`, `/site/redirects` |
| Content | `/posts`, `/posts/{slug}`, `/categories`, `/authors`, `/pages/{slug}` |
| Catalog | `/products`, `/products/{slug}`, `/releases` |
| Courses | `/courses`, `/courses/{slug}`, `/courses/{c}/preview/{l}`, `/verify/{id}` |
| Auth | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/forgot-password` |
| Cart | `/cart`, `/cart/items`, `/cart/coupon` |
| Checkout | `/checkout`, `/payments/{ref}/status`, `/payments/sslcommerz/ipn` |
| Account | `/me`, `/account/orders`, `/account/downloads`, `/account/courses`, `/account/activation-requests` |
| Learn | `/learn/{course}/outline`, `/learn/{course}/lessons/{lesson}`, `/quizzes/{id}` |
| Admin | `/admin/*` — কনটেন্ট, কমার্স, LMS, সাপোর্ট, ব্যবহারকারী, সেটিংস, অডিট |

## অনুমোদন

প্রতিটি সুরক্ষিত endpoint দুই স্তরে যাচাই হয়: রুটে একটি coarse রোল গেট, এবং
কন্ট্রোলারে ডেটার উৎসে policy। ফ্রন্টএন্ডে লিংক লুকানো কখনো নিরাপত্তা নয় —
`AuthorizationMatrixTest` প্রতিটি রোলের বিপরীতে এটি যাচাই করে।

## স্পেক হালনাগাদ

```bash
# openapi.yaml সম্পাদনার পরে
npm run contracts:lint      # স্পেক লিন্ট
npm run contracts:types     # TypeScript টাইপ + bundled JSON
npm run api:test -- --filter=ApiContractTest
```
