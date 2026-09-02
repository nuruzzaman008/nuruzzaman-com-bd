# NB Engineering Tools — মার্কেটিং কপির উৎস

এই ফাইলটি প্রোডাক্ট কপির **একমাত্র অনুমোদিত উৎস**। এখানে যা নেই, সাইটে তা লেখা
হবে না।

`CatalogSeeder` এই তথ্যগুলোই ডেটাবেসে বসায়; পরে অ্যাডমিন থেকে সম্পাদনা করা যায়।

## যাচাই করা তথ্য

গ্রাহকের জন্য প্রকাশিত ডকুমেন্ট থেকে নিশ্চিত করা:

- NB Engineering Tools v6.0
- Structural & Engineering Design Tools for AutoCAD
- Windows 10 / 11, 64-bit
- AutoCAD 2024, 2025, 2026 ও 2027-এর জন্য one-setup architecture, প্রতিটি
  ভার্সনের জন্য আলাদা security runtime
- ২৬টি compiled VLX application
- AutoCAD Ribbon এবং classic pull-down menu
- Machine activation, signed token refill, protected token wallet
- Vendor-verified license recovery
- Installer-এ upgrade / repair / uninstall / rollback / log workflow
- ডেভেলপার: Engr. Md. Nuruzzaman, RSE
- সফটওয়্যারটি একটি প্রকৌশল productivity aid; চূড়ান্ত যাচাই ও পেশাগত দায়িত্ব
  যোগ্য ব্যবহারকারীর

## পাবলিক ফিচার গ্রুপ

শুধু গ্রুপের নাম প্রকাশ করা হয় — ভেতরের কমান্ডের নাম, নির্ভুলতা বা গতি নিয়ে
কোনো দাবি নয়।

1. Layout, Grid & Schedule
2. Footing & Foundation
3. Geotechnical
4. Beam & Slab
5. Mouza & OCR
6. Dimension Utilities
7. License & System

## সামঞ্জস্যের বাক্য (হুবহু)

```text
Designed for AutoCAD 2024-2027.
Tested compatibility: [OWNER TO CONFIRM PER RELEASE].
```

`NB_TESTED_AUTOCAD_VERSIONS` সেট করা থাকলে দ্বিতীয় লাইনটি সেই মান দিয়ে
প্রতিস্থাপিত হয়। রানটাইম-টেস্টের প্রমাণ ছাড়া "সম্পূর্ণ পরীক্ষিত" লেখা হবে না।

## যা কখনো লেখা হবে না

- ফাইলের নাম বা কমান্ডের নাম দেখে অনুমান করা কোনো ক্ষমতা
- সময় সাশ্রয়ের শতাংশ ("৭০% দ্রুত") — পরিমাপ ছাড়া
- নির্ভুলতা বা কোড-সামঞ্জস্যের নিশ্চয়তা
- অন্য সফটওয়্যারের সঙ্গে তুলনামূলক দাবি
- গ্রাহকের সংখ্যা বা প্রশংসাপত্র — প্রকৃত, অনুমোদিত উৎস ছাড়া

## দাম

দাম এই ফাইলে নেই। মালিক অ্যাডমিন থেকে প্রকাশ করবেন। প্রকাশ না করা পর্যন্ত সাইটে
"দাম জানতে যোগাযোগ করুন" দেখানো হয় এবং Product schema-তে কোনো `Offer` যায় না।

## সিস্টেম রিকোয়ারমেন্ট (পাবলিক)

- Windows 10 বা 11, 64-bit
- AutoCAD 2024 / 2025 / 2026 / 2027 — full desktop সংস্করণ
- ইনস্টলেশনের সময় administrator অধিকার
- Activation ও token refill-এর সময় ইন্টারনেট

সাপোর্ট করে না: AutoCAD LT, 32-bit Windows, AutoCAD Web।

## ডেলিভারি প্যাকেজ

1. সাইন করা চূড়ান্ত ইনস্টলার
2. গ্রাহক গাইড
3. পর্যালোচিত EULA
4. রিলিজ নোট
5. SHA-256 চেকসাম
6. অ্যাক্টিভেশন ও সাপোর্ট নির্দেশনা

উৎস, বিল্ড সিস্টেম, ভেন্ডর টুল বা recovery ফাইল কখনো নয় —
[PRODUCT_FILE_SECURITY_BN.md](../docs/PRODUCT_FILE_SECURITY_BN.md)।
