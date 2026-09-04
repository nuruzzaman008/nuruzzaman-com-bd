<!--
  nuruzzaman.com.bd — seed articles (Bangla)

  Front matter, then the article body. Documents are separated by `@@@`.

  `reviewed_by` is the gate: an article without it is seeded as a DRAFT and is
  never published or indexed. Fill it in only after an engineer has actually
  read and checked the calculation.
-->

---
slug: isolated-footing-size-check-bangla
title: আইসোলেটেড ফুটিংয়ের সাইজ যাচাই — ধাপে ধাপে হিসাব
title_en: Checking an isolated footing size, step by step
excerpt: একটি বাস্তব সংখ্যা দিয়ে দেখানো হলো কীভাবে bearing pressure থেকে আইসোলেটেড ফুটিংয়ের প্রাথমিক সাইজ বের করবেন এবং কোথায় ভুল হয়।
excerpt_en: A worked example with real numbers: getting a first footing size from the allowable bearing pressure, and where it usually goes wrong.
categories: foundation-geotechnical|rcc-design-detailing
funnel_stage: awareness
search_intent: informational
reviewed_by: nuruzzaman
days_ago: 21
meta_description: Allowable bearing capacity থেকে আইসোলেটেড ফুটিংয়ের সাইজ বের করার সম্পূর্ণ হিসাব, অ্যাজাম্পশন ও সীমাবদ্ধতা সহ।
---

## সরাসরি উত্তর

আইসোলেটেড ফুটিংয়ের প্রাথমিক সাইজ বের করতে **service load** (factored নয়) কে
**allowable bearing capacity** দিয়ে ভাগ করতে হয়। ফুটিংয়ের নিজের ওজন ও উপরের মাটির
ওজনও হিসাবে ধরতে হয় — এই দুটো বাদ দিলে ফুটিং ছোট হয়ে যায়।

## উদাহরণ

একটি অভ্যন্তরীণ কলামের জন্য:

- Service dead load, `D` = ৬৫০ kN
- Service live load, `L` = ২২০ kN
- Allowable bearing capacity, `q_a` = ১৫০ kPa
- ফুটিংয়ের নিচের গভীরতা, `D_f` = ১.৫ m

### ধাপ ১ — নিট bearing capacity

ফুটিং ও উপরের মাটির গড় unit weight ধরা যাক ২০ kN/m³ (কংক্রিট ও মাটির মিশ্রণ)।

```
q_net = q_a - (গড় unit weight x D_f)
q_net = 150 - (20 x 1.5) = 120 kPa
```

### ধাপ ২ — প্রয়োজনীয় ক্ষেত্রফল

```
P_service = D + L = 650 + 220 = 870 kN
A_req = P_service / q_net = 870 / 120 = 7.25 m²
```

### ধাপ ৩ — বর্গাকার ফুটিং

```
B = sqrt(7.25) = 2.69 m  →  ব্যবহারিক মাপ 2.75 m x 2.75 m
```

### ধাপ ৪ — প্রকৃত চাপ যাচাই

```
A_provided = 2.75 x 2.75 = 7.5625 m²
q_actual = 870 / 7.5625 = 115.0 kPa  ≤  120 kPa  ✔
```

## যেখানে সবচেয়ে বেশি ভুল হয়

1. **Factored load দিয়ে সাইজ বের করা।** Bearing capacity একটি service-level সীমা।
   সাইজ service load দিয়ে, আর কংক্রিটের বেধ ও রড factored load দিয়ে।
2. **`D_f`-এর surcharge বাদ দেওয়া।** উপরে ১.৫ m মাটি থাকলে সেটি সরাসরি capacity কমায়।
3. **Eccentricity উপেক্ষা করা।** মোমেন্ট থাকলে `e = M/P` বের করে চাপ বণ্টন আলাদাভাবে
   যাচাই করতে হয়; `e > B/6` হলে ফুটিংয়ের একাংশে টান আসে।
4. **Settlement যাচাই না করা।** চাপ ঠিক থাকলেও settlement সীমা ছাড়িয়ে যেতে পারে।

## অ্যাজাম্পশন

- মাটির `q_a` জিওটেকনিক্যাল রিপোর্ট থেকে নেওয়া হয়েছে, অনুমান করা হয়নি।
- কোনো uplift, seismic overturning বা water table effect ধরা হয়নি।
- ইউনিট: kN, m, kPa। কোড এডিশন: BNBC-এর প্রযোজ্য সংস্করণ অনুযায়ী যাচাই করুন।

## সীমাবদ্ধতা

এটি কেবল **প্রাথমিক সাইজিং**। এরপর one-way shear, two-way (punching) shear,
bending moment, development length এবং settlement আলাদাভাবে যাচাই করতে হবে।
এই হিসাব কোনো নির্দিষ্ট প্রকল্পের জন্য প্রকৌশল পরামর্শ নয়।

@@@
---
slug: autocad-layer-standard-bangla
title: AutoCAD লেয়ার স্ট্যান্ডার্ড — একটি টিমের জন্য কার্যকর কাঠামো
title_en: An AutoCAD layer standard a team can actually keep to
excerpt: ড্রয়িং টিমে সবচেয়ে বেশি সময় নষ্ট হয় অসামঞ্জস্যপূর্ণ লেয়ার থেকে। একটি সহজ নামকরণ নিয়ম এবং তা প্রয়োগের ব্যবহারিক ধাপ।
excerpt_en: A practical layer setup for structural drawings, and what makes a standard survive contact with a deadline.
categories: autocad-productivity|engineering-software
funnel_stage: awareness
search_intent: informational
reviewed_by: nuruzzaman
days_ago: 14
meta_description: ছোট ও মাঝারি প্রকৌশল টিমের জন্য একটি ব্যবহারিক AutoCAD লেয়ার নামকরণ স্ট্যান্ডার্ড এবং প্রয়োগের ধাপ।
---

## সরাসরি উত্তর

লেয়ারের নাম **শৃঙ্খলা → উপাদান → উপ-উপাদান → অবস্থা** এই ক্রমে রাখলে বাছাই, ফ্রিজ
এবং প্লট-স্টাইল নিয়ন্ত্রণ সবচেয়ে সহজ হয়। উদাহরণ: `S-COL-RCC-NEW`।

## প্রস্তাবিত কাঠামো

```
<শৃঙ্খলা>-<উপাদান>-<উপ-উপাদান>-<অবস্থা>

শৃঙ্খলা : A (স্থাপত্য), S (স্ট্রাকচার), C (সিভিল/সাইট), E, P, M
অবস্থা  : NEW, EXST, DEMO, FUT
```

কিছু বাস্তব উদাহরণ:

| লেয়ার | কী রাখে |
|---|---|
| `S-COL-RCC-NEW` | নতুন RCC কলাম |
| `S-BEAM-RCC-NEW` | নতুন RCC বিম |
| `S-FTG-OUTL-NEW` | ফুটিং আউটলাইন |
| `S-REBAR-MAIN` | প্রধান রড |
| `S-DIM` | মাত্রা |
| `S-TEXT` | নোট ও লেবেল |
| `A-GRID` | গ্রিড লাইন |
| `X-REF` | এক্সটার্নাল রেফারেন্স |

## রঙ ও লাইনওয়েট

রঙকে প্লট-ওয়েটের সঙ্গে বাঁধুন, তারপর সেটি আর বদলাবেন না:

| রঙ | লাইনওয়েট | কোথায় |
|---|---|---|
| 1 (লাল) | 0.15 mm | মাত্রা, টেক্সট |
| 3 (সবুজ) | 0.25 mm | গৌণ আউটলাইন |
| 5 (নীল) | 0.35 mm | প্রধান স্ট্রাকচারাল আউটলাইন |
| 7 (সাদা/কালো) | 0.50 mm | কাটা অংশ, প্রধান রড |

## প্রয়োগের ধাপ

1. একটি খালি `template.dwt` ফাইলে সব লেয়ার তৈরি করুন।
2. `LAYERSTATE` দিয়ে অন্তত তিনটি অবস্থা সংরক্ষণ করুন: **Plan**, **Rebar**, **Print**।
3. পুরোনো ফাইলে `LAYTRANS` (Layer Translator) চালিয়ে ম্যাপিং প্রয়োগ করুন।
4. `PURGE` দিয়ে অব্যবহৃত লেয়ার সরান, তারপর `AUDIT` চালান।
5. টেমপ্লেটটি টিমের সবার `OPTIONS → Files → Template Settings`-এ যুক্ত করুন।

## কেন এটি সময় বাঁচায়

একটি ২০-শিটের প্রকল্পে অসামঞ্জস্যপূর্ণ লেয়ার থাকলে প্রতিবার প্লট সেটআপ করতে
হাতে ধরে লেয়ার ফ্রিজ করতে হয়। নামকরণ স্থির থাকলে `LAYERSTATE` একবার সেট করে
পুরো সেটে প্রয়োগ করা যায়।

## সীমাবদ্ধতা

ক্লায়েন্ট বা কনসালট্যান্টের নিজস্ব CAD স্ট্যান্ডার্ড থাকলে সেটিই অগ্রাধিকার পাবে।
এই কাঠামোটি তখন ভেতরের কাজের জন্য রেখে ডেলিভারির আগে `LAYTRANS` দিয়ে রূপান্তর করুন।

@@@
---
slug: one-way-slab-thickness-bangla
title: ওয়ান-ওয়ে স্ল্যাবের বেধ নির্ধারণ — deflection নিয়ন্ত্রণের সহজ হিসাব
title_en: Sizing a one-way slab: the deflection check that decides it
excerpt: স্ল্যাবের বেধ কত হবে তা প্রথমে deflection নিয়ন্ত্রণ থেকে ঠিক করা হয়। একটি সংখ্যাসহ উদাহরণ এবং কোথায় হিসাব বদলায়।
excerpt_en: Slab thickness is set by deflection control first. The simple check, and the span/depth ratios it rests on.
categories: rcc-design-detailing|structural-engineering
funnel_stage: awareness
search_intent: informational
reviewed_by: nuruzzaman
days_ago: 9
meta_description: ওয়ান-ওয়ে স্ল্যাবের ন্যূনতম বেধ span/depth অনুপাত থেকে বের করার ধাপে ধাপে হিসাব।
---

## সরাসরি উত্তর

ওয়ান-ওয়ে স্ল্যাবের প্রাথমিক বেধ **span-to-depth** অনুপাত থেকে ঠিক করা হয়, তারপর
সেই বেধ দিয়ে moment ও shear যাচাই করা হয়। শুরুতে moment থেকে বেধ বের করলে
সাধারণত deflection সীমা অতিক্রম করে।

## উদাহরণ

- ক্লিয়ার স্প্যান = ৩.৬ m
- সাপোর্ট বিমের প্রস্থ = ২৫০ mm (উভয় পাশে)
- দুই প্রান্তে ধারাবাহিক (continuous)
- `f_y` = ৪১৫ MPa, `f_c'` = ২৫ MPa

### ধাপ ১ — কার্যকর স্প্যান

```
L_eff = clear span + effective depth  (সাধারণত ছোটটি নেওয়া হয়)
প্রাথমিকভাবে: L_eff ≈ 3.6 + 0.25 = 3.85 m  (center-to-center)
```

### ধাপ ২ — span/depth থেকে ন্যূনতম বেধ

উভয় প্রান্তে ধারাবাহিক ওয়ান-ওয়ে স্ল্যাবে সাধারণ নির্দেশনা `L/28`:

```
h_min = L / 28 = 3850 / 28 = 137.5 mm
```

`f_y = 415 MPa`-এর জন্য সংশোধন প্রয়োগ করলে:

```
সংশোধন গুণক ≈ 0.4 + f_y / 700 = 0.4 + 415/700 = 0.993
h_min ≈ 137.5 x 0.993 = 136.6 mm  →  ব্যবহারিক মাপ 140 mm
```

### ধাপ ৩ — কার্যকর গভীরতা

২০ mm কভার ও ১০ mm রড ধরে:

```
d = 140 - 20 - (10/2) = 115 mm
```

### ধাপ ৪ — লোড ও মোমেন্ট যাচাই

```
স্ব-ওজন     = 0.140 x 24 = 3.36 kN/m²
ফিনিশিং     = 1.50 kN/m²
লাইভ লোড    = 2.00 kN/m²  (আবাসিক)
w_u = 1.2 x (3.36 + 1.50) + 1.6 x 2.00 = 5.83 + 3.20 = 9.03 kN/m²

M_u ≈ w_u x L² / 10  (ধারাবাহিক, আনুমানিক সহগ)
M_u ≈ 9.03 x 3.85² / 10 = 13.4 kN·m/m
```

১৪০ mm বেধ ও `d = 115 mm` দিয়ে এই মোমেন্ট সাধারণত ন্যূনতম রড দিয়েই সামলানো যায় —
অর্থাৎ deflection-ই এখানে নিয়ন্ত্রক শর্ত।

## কোথায় হিসাব বদলায়

- **একদিকে ধারাবাহিক** হলে `L/24`, **সরল সাপোর্ট** হলে `L/20` ব্যবহার করুন।
- **ক্যান্টিলিভার** হলে `L/10` — এবং deflection যাচাই আরও কঠোরভাবে করতে হয়।
- **ভারী পার্টিশন** থাকলে অতিরিক্ত dead load যোগ করুন, `L/d` নয়।

## অ্যাজাম্পশন

- ইউনিট: mm, m, kN, MPa।
- লোড সহগ ১.২D + ১.৬L ধরা হয়েছে; প্রকল্পের কোড এডিশন অনুযায়ী যাচাই করুন।
- আনুমানিক মোমেন্ট সহগ ব্যবহার করা হয়েছে; অসম স্প্যান বা অসম লোডে সরাসরি বিশ্লেষণ করুন।

## সীমাবদ্ধতা

এটি প্রাথমিক সাইজিং। চূড়ান্ত ডিজাইনে shear, crack width, ফায়ার রেটিং এবং
প্রকৃত deflection হিসাব আলাদাভাবে করতে হবে।

@@@
---
slug: rebar-lap-length-quick-reference-bangla
title: রড ল্যাপ লেংথ — ফিল্ডে কাজে লাগে এমন হিসাব
title_en: Rebar lap length: the figures that are useful on site
excerpt: ল্যাপ লেংথ মুখস্থ সংখ্যা নয়। কোন কোন বিষয়ে এটি বদলায়, এবং একটি বাস্তব হিসাব দিয়ে দেখানো হলো।
excerpt_en: Lap length is not a number to memorise. What changes it, and one worked example you can follow.
categories: rcc-design-detailing|construction-quality
funnel_stage: consideration
search_intent: informational
reviewed_by: nuruzzaman
days_ago: 4
meta_description: টেনশন ল্যাপ লেংথের হিসাব, প্রভাবকগুলো এবং সাইটে সবচেয়ে সাধারণ ভুল।
---

## সরাসরি উত্তর

ল্যাপ লেংথ = **development length × ক্লাস গুণক**। Development length নির্ভর করে
রডের ব্যাস, কংক্রিটের শক্তি, রডের গ্রেড, কভার, রডের ব্যবধান এবং রডের অবস্থানের উপর।
"৪০d সবসময়" — এটি একটি অনুমান, হিসাব নয়।

## উদাহরণ

- রড: ১৬ mm, `f_y` = ৪১৫ MPa
- কংক্রিট: `f_c'` = ২৫ MPa, স্বাভাবিক ওজনের
- অবস্থান: কলামের নিচের অংশ (bottom bar), পর্যাপ্ত কভার ও ব্যবধান

### ধাপ ১ — Development length

সরল আকারে (পর্যাপ্ত কভার ও ব্যবধান ধরে):

```
l_d / d_b = (f_y x ψ_t x ψ_e x λ) / (2.1 x sqrt(f_c'))

ψ_t = 1.0  (bottom bar)
ψ_e = 1.0  (আনকোটেড)
λ   = 1.0  (স্বাভাবিক ওজনের কংক্রিট)

l_d / d_b = 415 / (2.1 x 5) = 39.5
l_d = 39.5 x 16 = 633 mm
```

### ধাপ ২ — ল্যাপ ক্লাস

```
Class A (l_d x 1.0)  : সরবরাহকৃত রড ≥ ২ x প্রয়োজনীয় এবং এক অংশে ≤ ৫০% ল্যাপ
Class B (l_d x 1.3)  : বাকি সব ক্ষেত্রে

সাধারণ ক্ষেত্রে Class B ধরা নিরাপদ:
l_lap = 633 x 1.3 = 823 mm  →  ব্যবহারিক মাপ 850 mm
```

## কী কী হিসাব বদলায়

| অবস্থা | প্রভাব |
|---|---|
| Top bar (নিচে ≥ ৩০০ mm তাজা কংক্রিট) | `ψ_t = 1.3` — ৩০% বেশি |
| Epoxy-coated রড | `ψ_e` ১.২-১.৫ |
| হালকা কংক্রিট | `λ = 0.75` ভাগ — দৈর্ঘ্য বাড়ে |
| কম কভার বা ঘন রড | দৈর্ঘ্য বাড়ে |
| উচ্চতর `f_c'` | দৈর্ঘ্য কমে (`sqrt` অনুপাতে) |

## সাইটে সবচেয়ে সাধারণ ভুল

1. একই জায়গায় সব রড ল্যাপ করা — ল্যাপ ছড়িয়ে দিতে হয়।
2. Top bar-এর জন্য bottom bar-এর দৈর্ঘ্য ব্যবহার করা।
3. কলামের ল্যাপ জোনে টাই-এর ব্যবধান না কমানো।
4. ব্যাস বদলালেও পুরোনো দৈর্ঘ্য ব্যবহার করা।

## অ্যাজাম্পশন ও সীমাবদ্ধতা

সরলীকৃত সূত্র ব্যবহার করা হয়েছে, যা পর্যাপ্ত কভার ও ব্যবধান ধরে নেয়।
Seismic detailing, বিশেষ confinement বা প্রি-কাস্ট সংযোগে আলাদা নিয়ম প্রযোজ্য।
প্রকল্পের কোড এডিশন ও স্ট্রাকচারাল নোট সবসময় অগ্রাধিকার পাবে।

@@@
---
slug: nb-engineering-tools-workflow-overview
title: NB Engineering Tools দিয়ে একটি ড্রয়িং সেট তৈরির ওয়ার্কফ্লো
title_en: Producing a drawing set with NB Engineering Tools
excerpt: টুলগুলো আলাদা করে নয়, একটি বাস্তব ড্রয়িং সেটের ক্রম অনুযায়ী কীভাবে ব্যবহার করবেন।
excerpt_en: Not the tools one by one, but the order a real drawing set is built in, and where each one fits.
categories: autocad-productivity|engineering-software
funnel_stage: decision
search_intent: commercial
meta_description: NB Engineering Tools-এর feature group-গুলো একটি বাস্তব প্রকল্পের ক্রমে কীভাবে ব্যবহার করা হয়।
---

> এই লেখাটি খসড়া। প্রতিটি ধাপের স্ক্রিনশট ও যাচাই সম্পন্ন হলে প্রকাশ করা হবে।

## পরিকল্পিত কাঠামো

1. **Layout, Grid & Schedule** — গ্রিড বসানো, শিট সেটআপ, শিডিউল টেবিল তৈরি
2. **Footing & Foundation** — ফুটিং লেআউট ও ডিটেইল
3. **Geotechnical** — মাটির তথ্য থেকে ইনপুট প্রস্তুত
4. **Beam & Slab** — বিম-স্ল্যাব লেআউট ও রড ডিটেইল
5. **Dimension Utilities** — মাত্রা ও অ্যানোটেশন গুছিয়ে নেওয়া
6. **Mouza & OCR** — সাইট/মৌজা ম্যাপ ওয়ার্কফ্লো
7. **License & System** — Machine ID, activation ও credit অবস্থা

প্রতিটি ধাপে কোন কমান্ড, কী ইনপুট এবং কী আউটপুট — তা যাচাই করে যুক্ত করা হবে।
ফাইলের নাম দেখে কোনো ক্ষমতা অনুমান করে লেখা হবে না।

@@@
---
slug: bnbc-load-combination-notes
title: BNBC অনুযায়ী লোড কম্বিনেশন — কাজের নোট
title_en: Load combinations under BNBC: working notes
excerpt: কোন কম্বিনেশন কখন নিয়ন্ত্রক হয় এবং হাতে যাচাই করার সময় কী দেখা উচিত।
excerpt_en: Which combination governs when, and what to look at when you check the result by hand.
categories: bnbc-code-application|structural-engineering
funnel_stage: awareness
search_intent: informational
meta_description: লোড কম্বিনেশন বাছাই ও যাচাইয়ের ব্যবহারিক নোট।
---

> এই লেখাটি খসড়া। প্রযোজ্য BNBC সংস্করণ ও ধারা নম্বর যাচাই না হওয়া পর্যন্ত প্রকাশ করা হবে না।

## যা থাকবে

- কোন কম্বিনেশনগুলো সাধারণত নিয়ন্ত্রক হয় এবং কেন
- Dead, live, wind ও seismic-এর সহগ কীভাবে বদলায়
- Uplift ও overturning যাচাইয়ের সময় কোন কম্বিনেশন লাগে
- একটি সংখ্যাসহ উদাহরণ, ইউনিট ও অ্যাজাম্পশন সহ
