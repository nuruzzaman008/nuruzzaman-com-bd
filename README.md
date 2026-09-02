# nuruzzaman.com.bd

Engr. Md. Nuruzzaman, RSE-এর শিক্ষা ও ডিজিটাল-প্রোডাক্ট প্ল্যাটফর্ম: বাংলায়
প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং টিউটোরিয়াল, যাচাই করা টেকনিক্যাল আর্টিকেল, কোর্স, এবং
AutoCAD-এর জন্য NB Engineering Tools-এর বিক্রয়, সুরক্ষিত ডাউনলোড ও সাপোর্ট।

সবকিছু কাস্টম কোডে — কোনো WordPress, WooCommerce, Tutor LMS, Elementor বা
পেইড অ্যাডমিন প্যাকেজ ব্যবহার করা হয়নি।

## আর্কিটেকচার

| স্তর | প্রযুক্তি |
|---|---|
| ফ্রন্টএন্ড | Next.js 16 (App Router) + React 19 + TypeScript |
| স্টাইলিং | Tailwind CSS v4, CSS theme variables |
| ব্যাকএন্ড | Laravel 13 (PHP 8.4) REST API |
| ডেটাবেস | MySQL 8 (InnoDB, strict mode, utf8mb4) |
| সেশন/ক্যাশ/কিউ | Redis (না থাকলে MySQL ড্রাইভার) |
| অথেনটিকেশন | Laravel Sanctum — first-party cookie session + CSRF |
| API চুক্তি | OpenAPI 3.1 + জেনারেট করা TypeScript ক্লায়েন্ট |
| পেমেন্ট | সরাসরি SSLCOMMERZ ইন্টিগ্রেশন |
| ডিপ্লয়মেন্ট | Docker + Nginx + Next Node server + Laravel PHP-FPM |

ব্রাউজারের কাছে একটিই origin থাকে। Nginx `/api`, `/sanctum` ও পেমেন্ট কলব্যাক
Laravel-এ পাঠায়, বাকি সব Next.js-এ। এতে CORS লাগে না এবং সেশন কুকি first-party
থাকে।

বিস্তারিত: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## রিপোজিটরির কাঠামো

```text
apps/web        Next.js ফ্রন্টএন্ড (পাবলিক সাইট, অ্যাকাউন্ট, কোর্স প্লেয়ার, অ্যাডমিন)
apps/api        Laravel API (auth, commerce, LMS, licensing, admin)
packages/contracts   OpenAPI স্পেক + জেনারেট করা TypeScript টাইপ ও ক্লায়েন্ট
packages/eslint-config  শেয়ার করা লিন্ট নিয়ম
content         বাংলা সিড কনটেন্ট (পেজ, আর্টিকেল, কোর্স) ও এডিটোরিয়াল ক্যালেন্ডার
infra           Docker, Nginx ও হেল্পার স্ক্রিপ্ট
docs            আর্কিটেকচার, নিরাপত্তা, ডিপ্লয়মেন্ট ও চেকলিস্ট
```

## দ্রুত শুরু (Docker)

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# apps/api/.env-এ DB_PASSWORD, DB_ROOT_PASSWORD ও NEXT_REVALIDATE_SECRET বসান
docker compose up -d --build
docker compose exec api php artisan key:generate
docker compose exec api php artisan migrate --seed
docker compose exec api php artisan platform:make-admin you@example.com --name="Your Name"
```

সাইট: <http://localhost:8080>

## লোকাল ডেভেলপমেন্ট (Docker ছাড়া)

PHP লাগবে API-এর জন্য; ফ্রন্টএন্ড শুধু Node দিয়ে চলে।

```bash
npm install
npm run contracts:types          # OpenAPI থেকে TypeScript টাইপ

# টার্মিনাল ১ — API
cd apps/api && php artisan serve --port=8000

# টার্মিনাল ২ — ফ্রন্টএন্ড
npm run dev
```

PHP না থাকলে ফ্রন্টএন্ড একটি মক API দিয়েও চালানো যায়:

```bash
node apps/web/tools/mock-api.mjs 8001    # টার্মিনাল ১
npm run dev                              # টার্মিনাল ২ (.env.local ইতিমধ্যে এটিকে দেখায়)
```

মক API শুধু ডেভেলপমেন্ট ও CI স্মোক-বিল্ডের জন্য; প্রোডাকশনে ব্যবহৃত হয় না।

## কমান্ড

| কমান্ড | কাজ |
|---|---|
| `npm run dev` | Next.js ডেভ সার্ভার |
| `npm run build` | টাইপ জেনারেট করে প্রোডাকশন বিল্ড |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (ইউনিট ও কম্পোনেন্ট) |
| `npm run test:e2e` | Playwright |
| `npm run contracts:types` | OpenAPI → TypeScript + বান্ডেল করা JSON |
| `npm run contracts:lint` | OpenAPI স্পেক লিন্ট |
| `npm run api:test` | Laravel টেস্ট (Docker-এ) |
| `npm run api:artisan -- migrate` | Artisan কমান্ড (Docker-এ) |

## নীতি

- **কোনো বানানো তথ্য নয়।** দাম, ফোন, ঠিকানা বা সামঞ্জস্যের দাবি মালিক না দেওয়া
  পর্যন্ত সৎভাবে "প্রকাশ করা হয়নি" দেখানো হয়।
- **আইনি পাতা** পেশাগত পর্যালোচনা রেকর্ড না হওয়া পর্যন্ত দৃশ্যমান DRAFT নোটিশ বহন করে।
- **টাকা** সবসময় পূর্ণসংখ্যা minor unit-এ; কোথাও float নয়।
- **পেমেন্ট** শুধু গেটওয়ের নিজস্ব validation API-এর নিশ্চিতকরণের পরে গ্রহণ করা হয়;
  success URL-এ ফেরা কিছুই প্রমাণ করে না।
- **ইনস্টলার** প্রাইভেট ডিস্কে থাকে; কখনো `/public`-এ নয়।
- **Machine ID** এনক্রিপ্ট করে রাখা হয় এবং সবসময় মাস্ক করে দেখানো হয়।
- **কোনো signing key, token বা recovery ফাইল** এই সিস্টেমে রাখা হয় না।

## ডকুমেন্টেশন

সম্পূর্ণ সূচি: [docs/README.md](docs/README.md)

সবচেয়ে বেশি দরকার হয় যেগুলো:

| ডকুমেন্ট | কার জন্য |
|---|---|
| [CONFIGURATION_CHECKLIST_BN.md](docs/CONFIGURATION_CHECKLIST_BN.md) | মালিক — দাম, ক্রেডেনশিয়াল, আইনি অনুমোদন |
| [LAUNCH_CHECKLIST_BN.md](docs/LAUNCH_CHECKLIST_BN.md) | লঞ্চের আগে প্রতিটি গেট |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | ডেভেলপার |
| [ADMIN_GUIDE_BN.md](docs/ADMIN_GUIDE_BN.md) | সম্পাদক ও সাপোর্ট |
| [DEPLOYMENT_BN.md](docs/DEPLOYMENT_BN.md) | ডিপ্লয়মেন্ট |
| [TEST_REPORT.md](docs/TEST_REPORT.md) | কী পরীক্ষা করা হয়েছে, কী বাকি |
