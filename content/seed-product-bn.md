# NB Engineering Tools — মার্কেটিং কপির উৎস

এই ফাইলটি প্রোডাক্ট কপির **একমাত্র অনুমোদিত উৎস**। এখানে যা নেই, সাইটে তা লেখা
হবে না।

`CatalogSeeder` এই তথ্যগুলোই ডেটাবেসে বসায়; পরে অ্যাডমিন থেকে সম্পাদনা করা যায়।

## উৎস নথি

মালিকের নিজের প্রকাশিত গ্রাহক-নথি:
`NB Engineering Tools for AutoCAD.pdf` (Final version-13082026, ১৫ পৃষ্ঠা)।
নিচের প্রতিটি বাক্য ওই নথি থেকে নেওয়া।

## AutoCAD সামঞ্জস্য

**মালিক ৩ সেপ্টেম্বর ২০২৬-এ নিশ্চিত করেছেন: বর্তমান বিক্রয়যোগ্য build
AutoCAD 2024, 2025, 2026 ও 2027 সমর্থন করে।**

এর আগে সাইটে ২০২৪–২০২৭ লেখা ছিল কেবল বিল্ড ফোল্ডারের নাম
(`..._MULTIVERSION_2024_2027_ONE_SETUP`) দেখে — যা কোনো প্রমাণ নয়। মাঝে পুরোনো
PDF-এর "Compatible Version: AutoCAD 2024" বাক্যটি ব্যবহার করা হয়েছিল। এখন এটি
মালিকের সরাসরি নিশ্চিতকরণ, অনুমান নয়।

মান বদলাতে: `NB_DESIGNED_FOR` (ডিফল্ট `AutoCAD 2024-2027`)।

> **ডিজাইন লক্ষ্য ≠ পরীক্ষিত।** কোন রিলিজে রানটাইম টেস্ট হয়েছে তা আলাদা তথ্য।
> `NB_TESTED_AUTOCAD_VERSIONS` ফাঁকা থাকা পর্যন্ত সাইট কোনো ভার্সনকে "পরীক্ষিত"
> বলবে না। প্রতিটি ভার্সনে টেস্ট করে ফল লিখে ওই মানটি সেট করুন।

## যাচাই করা তথ্য

- NB Engineering Tools v6.0
- Structural & Engineering Design Tools for AutoCAD
- Windows 10 / 11, 64-bit
- ২৫টি engineering/productivity মডিউল + ১টি core/security মডিউল = মোট ২৬টি
  compiled VLX মডিউল
- AutoCAD Ribbon এবং classic pull-down menu
- Machine activation, token/credit licensing, signed activation ও refill workflow
- Professional Windows Setup EXE
- Vendor-verified license recovery
- ডেভেলপার: Engr. Md. Nuruzzaman, RSE
- সফটওয়্যারটি একটি প্রকৌশল productivity ও automation aid; চূড়ান্ত engineering
  সিদ্ধান্ত, ডিজাইন যাচাই, কোড সঙ্গতি ও কাঠামোগত নিরাপত্তার দায়িত্ব যোগ্য
  প্রকৌশলীর

## পাবলিক ফিচার গ্রুপ

শুধু গ্রুপের নাম প্রকাশ করা হয় — ভেতরের কমান্ডের নির্ভুলতা বা গতি নিয়ে কোনো
দাবি নয়।

1. Layout, Grid & Schedule
2. Footing & Foundation
3. Geotechnical
4. Beam & Slab
5. Mouza & OCR
6. Dimension Utilities
7. License & System

## মডিউল তালিকা

PDF-এর পৃষ্ঠা ৩–৪ থেকে। মডিউলের কার্যকারিতা ভার্সন অনুযায়ী পরিবর্তিত ও উন্নত
হতে পারে।

| মডিউল | প্রধান ব্যবহার |
| --- | --- |
| NBFooting | Isolated footing design, reinforcement, plan, section এবং estimate workflow |
| NBCombinedFooting | Combined footing design ও drawing |
| NBPileCap | Pile cap plan, section, code/design checks এবং reinforcement |
| NBPileCenter | Pile center/layout related workflow |
| NBLoadPile | Load ও pile-foundation related layout/drawing |
| NBSoilCapacity | Soil bearing capacity related calculation |
| NBGeotech | Geotechnical engineering workflow |
| NBDevLength | Reinforcement development length calculation |
| NBBeam | RCC beam related engineering drawing |
| NBBeamSpan | Beam span/column measurement workflow |
| NBGBDraw | Grade beam drawing automation |
| NBSlabDraw | Slab reinforcement/crank rod drawing automation |
| NBSTRD | Slab thickness/rod related structural design workflow |
| NBColumnLayout | Column layout preparation |
| NBColumnLoad | Column load related workflow |
| NBColumnSchedule | Column schedule preparation |
| NBGrid | Structural grid-line automation |
| NBFootingLoadArea | Footing/column load-area related workflow |
| NBFootingExcel | Footing information/estimate export workflow |
| NBNameText | Footing/column naming and text automation |
| NBQuickBlock | Quick AutoCAD block productivity tool |
| NBRM | Room name ও architectural feet-inch room measurement |
| NBMouza | Mouza drawing/OCR related engineering drafting workflow |
| NBDFM | Dimension/drafting utility |
| NBDITM | Engineering dimension/conversion utility |
| NBCore | Security, initialization ও compiled-runtime support module |

## সামঞ্জস্যের বাক্য

> বর্তমান commercial build AutoCAD 2024, 2025, 2026 ও 2027, Windows 10/11 64-bit
> environment-এর জন্য প্রস্তুত। AutoCAD 2020–2023 বা এর আগের ভার্সন সমর্থিত নয়।
> কোন রিলিজে রানটাইম পরীক্ষা সম্পন্ন হয়েছে তা আলাদাভাবে জানানো হয়।

## Machine ID ও অ্যাক্টিভেশন

প্রতিটি সমর্থিত কম্পিউটার একটি Machine ID তৈরি করে:

```
NBM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
```

লাইসেন্স এই Machine ID-র সাথে bind করা হয়। ভেন্ডর গ্রাহকের তথ্য ও Machine ID
যাচাই করে signed activation key issue করেন।

**Activation** সফটওয়্যার ব্যবহারের অনুমতি দেয়; **Token** নির্দিষ্ট paid
engineering operation চালানোর ক্রেডিট। একটি সক্রিয় লাইসেন্স থাকলেও paid
operation চালাতে পর্যাপ্ত token লাগতে পারে।

## টোকেন নীতি

- প্রতিটি টুলের token cost এক নয়।
- কিছু টুল সফল command session অনুযায়ী charge করে।
- কিছু design টুল সফল **unique design** অনুযায়ী charge করে। উদাহরণ: ২৪টি ফুটিং
  নির্বাচন করেও unique design ২টি হলে unique design নীতিতেই charge হয়।
- বাতিল বা ব্যর্থ operation-এ প্রযোজ্য টুলের যুক্তি অনুযায়ী charge না-ও হতে পারে।
- বর্তমান balance AutoCAD-এর License & Tokens ইন্টারফেসে দেখা যায়।

প্যাকেজের উদাহরণ: ১০০, ৫০০, ১,০০০, ২,০০০, ৫,০০০ token, অথবা vendor-approved
custom amount।

**দাম প্রকাশ করা হয়নি।** মালিক দাম নির্ধারণ করে কনফিগার না করা পর্যন্ত সাইটে
কোনো সংখ্যা দেখানো হবে না।

## Windows reinstall ও টোকেন

- শুধু AutoCAD uninstall/reinstall করলে এবং Windows-এর ডেটা অক্ষত থাকলে
  license/token সাধারণত থেকে যায়।
- Windows নতুন setup, reinstall, reset বা system drive format করলে স্থানীয়
  license/token ডেটা মুছে যেতে পারে। **Token 0 হয়ে গেলে আগের token
  স্বয়ংক্রিয়ভাবে ফিরে পাওয়ার নিশ্চয়তা নেই; নতুন token কিনতে হবে।**

### ৩০ মিনিটের screenshot exception

Windows setup-এর সর্বোচ্চ ৩০ মিনিট আগে তোলা স্পষ্ট screenshot থাকলে ভেন্ডর
যাচাইয়ের পর অবশিষ্ট token পুনরায় issue করা যেতে পারে। Screenshot-এ স্পষ্ট
থাকতে হবে: License/Token ইন্টারফেস, বর্তমান Token Balance, License ID,
Machine ID, গ্রাহক/লাইসেন্স পরিচয়, এবং Windows-এর দৃশ্যমান তারিখ ও সময়।

### যেসব ক্ষেত্রে restore হবে না

screenshot ৩০ মিনিটের বেশি আগে নেওয়া; balance অস্পষ্ট; Machine ID/License
যাচাই করা যাচ্ছে না; screenshot সম্পাদিত বা সন্দেহজনক; তারিখ/সময় যাচাই করা
যাচ্ছে না; screenshot নেই; অন্য লাইসেন্স বা অন্য গ্রাহকের; ভেন্ডর রেকর্ডের
সাথে তথ্য মিলছে না। **ভেন্ডরের যাচাই-সিদ্ধান্ত চূড়ান্ত।**

## Refund

Token একটি digital usage credit। একবার valid refill key issue ও successfully
applied হয়ে গেলে সাধারণত refundable নয়। ভুল Machine ID বা License ID দিলে
ভেন্ডর যাচাই ছাড়া replacement নিশ্চিত নয়।

## Activation transfer

লাইসেন্স machine-bound। Motherboard বা বড় hardware পরিবর্তনে, বা নতুন
কম্পিউটারে Machine ID বদলে যেতে পারে। নতুন কম্পিউটারে transfer স্বয়ংক্রিয় নয় —
গ্রাহকের পরিচয়, পূর্ববর্তী License ID ও purchase record যাচাইয়ের পর প্রযোজ্য
বাণিজ্যিক নীতি অনুযায়ী ভেন্ডর সিদ্ধান্ত নেন।

## নিষিদ্ধ ব্যবহার

Activation bypass; token/security mechanism পরিবর্তন; compiled file reverse
engineer করার চেষ্টা; unauthorized redistribution; license key resale; অন্য
গ্রাহকের Machine ID/License ব্যবহার; third-party-কে commercial use-এর জন্য কপি
দেওয়া। ধরা পড়লে লাইসেন্স suspend/terminate করা হতে পারে।

## কার জন্য

Structural engineer, civil engineer, engineering consultant, structural design
office, AutoCAD drafting professional, foundation design professional, ছোট ও
মাঝারি engineering consultancy firm, এবং যাঁরা পুনরাবৃত্ত AutoCAD structural
কাজ automate করতে চান।

## ইনস্টলেশন

```
Welcome → System Check → License Agreement → Install → Finish
```

ইনস্টল শেষে AutoCAD চালু করলে NB Engineering Tools Ribbon পাওয়া যায়। এরপর:
Machine ID নিন → লাইসেন্স ক্রয়/অ্যাক্টিভেশন → signed activation key প্রয়োগ →
প্রয়োজন অনুযায়ী token refill → টুল ব্যবহার।

## যোগাযোগ

- ওয়েবসাইট: nuruzzaman.com.bd
- সাপোর্ট ইমেইল: nuruzzaman008@gmail.com

## SEO (মালিকের নির্ধারিত)

- **Title:** NB Engineering Tools for AutoCAD | Structural Design, Footing,
  Pile Cap, Beam & Slab Automation Software
- **Recommended slug:** `/nb-engineering-tools-autocad-structural-design-software/`
  সাইটের canonical ঠিকানা `/engineering-tools`, আর এই slug থেকে ৩০১ redirect
  দেওয়া আছে — প্রচারিত লিংক কাজ করবে, কিন্তু canonical একটিই থাকবে।
- **Focus keywords:** NB Engineering Tools, AutoCAD Structural Design Software
  Bangladesh, AutoCAD Civil Engineering Plugin, Footing Design AutoCAD, Pile Cap
  Design Software, Slab Reinforcement AutoCAD, Structural Engineering Software
  Bangladesh, AutoCAD Engineering Automation, BNBC Engineering Tools

মূল SEO title-এ AutoCAD-এর ভার্সন সংখ্যা ইচ্ছাকৃতভাবে বাদ দেওয়া হয়েছে, কারণ
উপরের সামঞ্জস্য-প্রশ্ন এখনো অমীমাংসিত।
