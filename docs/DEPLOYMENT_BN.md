# ডিপ্লয়মেন্ট

## টপোলজি

```text
Internet
  ↓
Cloudflare (CDN / WAF / DNS)
  ↓
Nginx  ──→ Next.js Node service (standalone)
       ──→ Laravel PHP-FPM
       ──→ Laravel queue worker
       ──→ Laravel scheduler
              ↓
        MySQL · Redis · প্রাইভেট অবজেক্ট স্টোরেজ · SMTP · SSLCOMMERZ · ভিডিও
```

Next.js **static export ব্যবহার করা যাবে না** — অথেনটিকেশন, চেকআউট, অ্যাকাউন্ট
ও কোর্স প্লেয়ারের জন্য per-request রেন্ডারিং লাগে। তাই হোস্টে একটি দীর্ঘস্থায়ী
Node.js প্রসেস চালানোর ব্যবস্থা থাকতেই হবে।

## Docker দিয়ে (প্রস্তাবিত)

```bash
cp .env.example .env                     # DB_PASSWORD, DB_ROOT_PASSWORD, secret
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

docker compose up -d --build
docker compose exec api php artisan key:generate
docker compose exec api php artisan migrate --force
docker compose exec api php artisan db:seed --force
docker compose exec api php artisan storage:link
docker compose exec api php artisan platform:make-admin you@example.com --name="Your Name"
```

সার্ভিস: `nginx`, `web`, `api`, `queue`, `scheduler`, `mysql`, `redis`।

## ইমেজে কোনো secret নেই

দুটো Dockerfile-ই শুধু কোড ও নির্ভরতা বহন করে। প্রতিটি ক্রেডেনশিয়াল রানটাইমে
environment থেকে আসে, তাই একই ইমেজ staging থেকে production-এ প্রমোট করা নিরাপদ।

Next.js বিল্ডে শুধু `NEXT_PUBLIC_*` মান ইনলাইন হয় — সেগুলো সংজ্ঞা অনুযায়ী পাবলিক।

## মাইগ্রেশন ও রোলব্যাক

```bash
# ডিপ্লয়ের আগে
docker compose exec api php artisan down --render=errors::503 --retry=60
docker compose exec api php artisan migrate --force
docker compose exec api php artisan config:cache route:cache view:cache
docker compose exec api php artisan up
```

রোলব্যাক পরিকল্পনা:

1. আগের ইমেজ ট্যাগে ফিরে যান (`docker compose up -d` নতুন ট্যাগ দিয়ে)।
2. মাইগ্রেশন ভাঙা হলে `php artisan migrate:rollback --step=1`।
3. ডেটা ক্ষতিগ্রস্ত হলে ব্যাকআপ থেকে restore —
   [BACKUP_RESTORE_BN.md](BACKUP_RESTORE_BN.md)।

প্রতিটি মাইগ্রেশনে `down()` লেখা আছে, তাই রোলব্যাক পরীক্ষা করা যায়।

## হেলথ ও রেডিনেস

| endpoint | কী বলে |
|---|---|
| `GET /up` | Laravel চালু ও bootstrap সফল |
| `GET /robots.txt` | Next.js প্রসেস সাড়া দিচ্ছে |

তিনটি ইমেজেই `HEALTHCHECK` আছে, তাই compose বা orchestrator নিজেই অসুস্থ কনটেইনার
ধরতে পারে।

## Redis না থাকলে

অনেক শেয়ার্ড হোস্টে Redis নেই। সেক্ষেত্রে `apps/api/.env`-এ:

```env
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database
```

প্রয়োজনীয় টেবিল (`sessions`, `cache`, `jobs`, `job_batches`, `failed_jobs`)
ইতিমধ্যেই মাইগ্রেশনে আছে। queue worker আলাদা প্রসেস হিসেবে চালাতে হবে:

```bash
php artisan queue:work --tries=3 --max-time=3600
```

কার্যকারিতা এক থাকে; উচ্চ ট্রাফিকে Redis দ্রুততর। database ড্রাইভারে
ডিভাইস-তালিকার ফিচারটিও চালু থাকে (Redis সেশনে সেটি সৎভাবে "উপলব্ধ নয়" বলে)।

## Docker ছাড়া হোস্টিং

cPanel-এর ধাপে ধাপে নির্দেশনা আলাদা ফাইলে:
[DEPLOY_CPANEL_BN.md](DEPLOY_CPANEL_BN.md) — রিপোজিটরির `.cpanel.yml` ও
`infra/cpanel/deploy.sh` সেটিই চালায়।

সারসংক্ষেপ, Docker/Nginx-এ অ্যাক্সেস না থাকলে:

1. **Laravel** — যেকোনো cPanel/LiteSpeed/PHP হোস্টে; document root
   `apps/api/public`।
2. **Next.js** — হোস্টিং প্যানেলের Node.js অ্যাপ্লিকেশন ম্যানেজার বা PM2 দিয়ে
   `node apps/web/.next/standalone/apps/web/server.js` চালান।
3. `/api`, `/sanctum`, `/storage`, `/up` PHP-তে এবং বাকি সব Node-এ পাঠান।
   প্যানেলে reverse proxy না থাকলে (সাধারণত থাকে না) Next নিজেই এই রাউটিং করতে
   পারে — বিল্ডের সময় `NB_API_PROXY` সেট করুন। ব্রাউজার এক origin-এই থাকতে
   হবে, নইলে Sanctum-এর session cookie যাবে না এবং প্রতিটি সাইন ইন 419 দেবে।

হোস্ট যদি দীর্ঘস্থায়ী Node প্রসেস **চালাতেই না পারে**, তবে এই আর্কিটেকচার সেখানে
ডিপ্লয় হবে না। সেক্ষেত্রে static export দিয়ে ফিচার ভাঙার বদলে ফ্রন্টএন্ডকে
Node-সক্ষম আলাদা হোস্টে (যেমন একটি ছোট VPS) ডিপ্লয় করে একই ডোমেইনের পেছনে
proxy করতে হবে — অথবা Laravel-এর হোস্টেই Node চালানোর ব্যবস্থা করতে হবে।

## SSLCOMMERZ

- হোস্টে অবশ্যই বৈধ TLS থাকতে হবে।
- IPN URL: `https://nuruzzaman.com.bd/api/v1/payments/sslcommerz/ipn` —
  মার্চেন্ট প্যানেলে এটি সেট করতে হবে।
- Live-এ যাওয়ার আগে sandbox-এ সফল, ব্যর্থ, বাতিল ও ডুপ্লিকেট IPN পরীক্ষা করুন।

## লগ ও মনিটরিং

- Laravel structured লগ; প্রতিটি লাইনে `request_id` যা রেসপন্স হেডারেও যায়।
- `failed_jobs` টেবিল নিয়মিত দেখুন; `php artisan queue:retry all`।
- Nginx access/error লগ।
- নজরে রাখার মতো: `payments` টেবিলে `risk_hold` সারি, দীর্ঘ সময় `pending_payment`
  থাকা অর্ডার, এবং reconciliation জবের আউটপুট।

## ডেটাবেস ও API একই অঞ্চলে

MySQL ও PHP-FPM একই অঞ্চলে (আদর্শভাবে একই নেটওয়ার্কে) রাখুন। প্রতি রিকোয়েস্টে
একাধিক query হয়; আন্তঃঅঞ্চল latency সরাসরি TTFB-তে যোগ হয়।
