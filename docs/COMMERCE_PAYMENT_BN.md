# কমার্স ও পেমেন্ট

## অর্ডারের অবস্থা

```text
draft -> pending_payment -> paid -> fulfilled
                         -> failed
                         -> cancelled

paid | fulfilled -> refund_pending -> refunded | partially_refunded
```

অবস্থা পরিবর্তন শুধু `App\Services\Commerce\OrderStateMachine`-এ হয়। সেটি
প্রতিটি পরিবর্তন `order_status_events` টেবিলে ও অডিট লগে লেখে, এবং অবৈধ পরিবর্তন
৪০৯ দিয়ে ফিরিয়ে দেয় — এমনকি অ্যাডমিন চাইলেও।

## দাম কোথায় ঠিক হয়

`PricingService` একমাত্র জায়গা যেখানে কার্টের হিসাব হয়। ব্রাউজার শুধু
`variant_id` ও `quantity` পাঠাতে পারে; মোট, ছাড় ও কর সবসময় সার্ভারে আবার গণনা
করা হয়। টেস্টে এটি সরাসরি যাচাই করা হয়েছে: চেকআউটে `total_minor` পাঠালেও অর্ডারে
সার্ভারের হিসাবই থাকে।

টাকা সবসময় পূর্ণসংখ্যা minor unit-এ (১ টাকা = ১০০ পয়সা)। `App\Support\Money`
ছাড়া কোথাও অঙ্ক করা হয় না, এবং শতকরা ছাড় minor unit-এ round-half-up করে —
তাই ভগ্নাংশ পয়সা কখনো তৈরি হয় না।

দাম প্রকাশ না করা থাকলে ভ্যারিয়েন্ট বিক্রয়যোগ্য নয় এবং সাইটে "দাম জানতে যোগাযোগ
করুন" দেখানো হয়। কোথাও শূন্য দাম দেখানো হয় না, এবং Product schema-তেও তখন কোনো
`Offer` যোগ করা হয় না।

## SSLCOMMERZ প্রবাহ

```text
1. গ্রাহক চেকআউট করে (auth + server-priced cart)
2. একটি ট্রানজেকশনে pending order + payment রেকর্ড তৈরি
3. সার্ভার-টু-সার্ভার session তৈরি (store id/password কখনো ব্রাউজারে যায় না)
4. গ্রাহককে SSLCOMMERZ-এর hosted page-এ পাঠানো হয়
5. success / fail / cancel URL শুধু UI ইঙ্গিত — কিছু নিষ্পত্তি করে না
6. IPN আসে (POST /api/v1/payments/sslcommerz/ipn)
7. Order Validation API দিয়ে যাচাই: tran_id, amount, currency, status, risk
8. payment_events-এ fingerprint সহ একবারই সংরক্ষণ
9. বৈধ ও ঝুঁকিমুক্ত হলে order -> paid
10. ট্রানজেকশন commit হওয়ার পরে FulfillOrder queue-তে যায়
```

### কেন return URL যথেষ্ট নয়

গ্রাহকের ব্রাউজার যেকোনো URL-এ যেতে পারে। তাই success পাতায় পৌঁছানো কোনো প্রমাণ
নয়; ওই পাতা শুধু একটি read-only status endpoint পোল করে এবং নিশ্চিতকরণ না আসা
পর্যন্ত "নিশ্চিত করা হচ্ছে" দেখায়।

### ডুপ্লিকেট ও out-of-order কলব্যাক

প্রতিটি কলব্যাকের একটি fingerprint হিসাব করা হয় (source + tran_id + val_id +
status + bank_tran_id)। `payment_events.fingerprint` unique, তাই একই কলব্যাক
তিনবার এলেও একবারই সংরক্ষিত ও প্রক্রিয়াজাত হয়। নিষ্পত্তি হয়ে যাওয়া পেমেন্ট পরে
আসা কোনো "FAILED" কলব্যাক দিয়ে বাতিল হয় না — টেস্টে এটি যাচাই করা আছে।

### ঝুঁকিপূর্ণ পেমেন্ট

গেটওয়ে `risk_level` পাঠালে ডিফল্ট আচরণ `manual_hold`: পেমেন্ট `risk_hold`
অবস্থায় যায়, অর্ডার paid হয় না, কোনো ফুলফিলমেন্ট চলে না। মালিক চাইলে
`NB_RISK_ORDER_POLICY=auto_release` দিয়ে এটি বদলাতে পারেন।

### Reconciliation

`ReconcilePayments` প্রতি ১৫ মিনিটে চলে এবং যেসব পেমেন্ট অনেকক্ষণ ধরে pending,
সেগুলো আবার যাচাই করে। যাচাই ও নিষ্পত্তি একই `PaymentProcessor` দিয়ে হয়, তাই
reconciliation কখনো দুইবার ফুলফিল করতে পারে না।

## Idempotency

`POST /api/v1/checkout` এবং রিফান্ড অনুমোদন `Idempotency-Key` হেডার গ্রহণ করে।

* একই key + একই body → আগের রেসপন্স ফিরে আসে (`Idempotency-Replayed: true`)
* একই key + ভিন্ন body → ৪০৯
* ব্যর্থ রেসপন্স সংরক্ষণ করা হয় না, যাতে পুনরায় চেষ্টা করা যায়

চেকআউট ফর্ম প্রতি প্রচেষ্টায় একটি key তৈরি করে, তাই ডাবল-ক্লিক বা সংযোগ ছিঁড়ে
গিয়ে রিট্রাই হলেও দুইটি অর্ডার তৈরি হয় না।

## রিফান্ড

রিফান্ড দুই ধাপে: একজন অনুরোধ করেন, আরেকজন (বা পরে) অনুমোদন করেন। অনুমোদনের পর
`ProcessRefund` queue জব গেটওয়েতে রিফান্ড পাঠায়, `refunded_minor` বাড়ায় এবং
অর্ডারকে `refunded` বা `partially_refunded`-এ নেয়। `revoke_entitlements` সত্য
হলে ডাউনলোড, এনরোলমেন্ট ও লাইসেন্স প্রত্যাহার করা হয়।

## ক্রেডেনশিয়াল ছাড়া পরীক্ষা

`SSLCOMMERZ_DRIVER=fake` (ডিফল্ট) হলে `FakeGateway` bind হয়। এটি একই ইন্টারফেস
মেনে চলে এবং amount/currency tampering ঠিক আসল গেটওয়ের মতোই প্রত্যাখ্যান করে,
তাই ক্রেডেনশিয়াল ছাড়াই পুরো পথ পরীক্ষা করা যায়।

Laravel টেস্টে যা যাচাই করা হয়েছে: বৈধ IPN, tampered amount, ভুল currency,
ডুপ্লিকেট IPN, failed কলব্যাক, নিষ্পত্তির পরে আসা failure, ঝুঁকিপূর্ণ পেমেন্ট,
অজানা reference, return URL, এবং অন্যের পেমেন্ট দেখার চেষ্টা।

## গোপনীয়তা

কার্ডের কোনো তথ্য এই সিস্টেমে আসে না বা সংরক্ষিত হয় না — পুরো পেমেন্ট
SSLCOMMERZ-এর hosted page-এ হয়। store id ও password শুধু Laravel-এর environment-এ
থাকে; কখনো `NEXT_PUBLIC_` ভেরিয়েবলে, Git-এ বা ব্রাউজারে নয়।

রেফারেন্স: <https://developer.sslcommerz.com/doc/v4/index.html>
