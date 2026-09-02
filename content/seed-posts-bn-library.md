<!--
  nuruzzaman.com.bd — article library (Bangla)

  Same format as seed-posts-bn.md: front matter between `---` fences, then the
  body, with `@@@` between documents.

  `reviewed_by` records that a named engineer has actually checked the working.
  An article without it still publishes, but the page says the technical review
  is outstanding and the structured data claims no reviewer. Add `publish: false`
  to hold one back entirely.

  Every worked example states its assumptions and its limits. None of these
  replace a project-specific design by a responsible engineer.
-->

---
slug: spt-n-value-to-allowable-bearing-capacity
title: SPT N-value থেকে allowable bearing capacity — কীভাবে, আর কোথায় সাবধান
excerpt: মাঠের SPT N থেকে প্রাথমিক bearing capacity বের করার প্রচলিত পথ, correction গুলো, এবং কেন এই সংখ্যা চূড়ান্ত ডিজাইনের ভিত্তি নয়।
categories: foundation-geotechnical
funnel_stage: awareness
search_intent: informational
days_ago: 4
meta_description: SPT N-value থেকে allowable bearing capacity বের করার ধাপ, overburden ও hammer efficiency correction, এবং এর সীমাবদ্ধতা।
---

## সরাসরি উত্তর

মাঠের SPT N সরাসরি bearing capacity নয়। আগে N-কে correction করতে হয়, তারপর
correlation দিয়ে **প্রাথমিক** allowable bearing capacity অনুমান করা যায়। এই সংখ্যা
feasibility ও প্রাথমিক সাইজিংয়ের জন্য — চূড়ান্ত ডিজাইনের জন্য soil report লাগবেই।

## Correction গুলো কী কী

মাঠে পাওয়া N (raw) থেকে ব্যবহারযোগ্য N পেতে সাধারণত দুই ধরনের correction ধরা হয়:

- **Hammer energy correction** — আদর্শ ৬০% energy-এর সাপেক্ষে। ফলাফল `N₆₀`।
- **Overburden correction** — গভীরতা বাড়লে একই মাটিতে N বেশি আসে। ফলাফল `(N₁)₆₀`।

বাংলাদেশে donut hammer সাধারণ, যার efficiency প্রায়ই ৪৫–৫৫% ধরা হয়। মানে raw N
কে বাড়িয়ে নিতে হয়, কমিয়ে নয় — এখানেই বেশি ভুল হয়।

## উদাহরণ

ধরা যাক একটি বালুময় স্তরে ২.০ m গভীরতায় raw N = ১২, hammer efficiency ৫০%।

### ধাপ ১ — energy correction

```
N₆₀ = N × (E / 60) = 12 × (50 / 60) ≈ 10
```

### ধাপ ২ — প্রাথমিক অনুমান

সাধারণ সীমিত-settlement correlation-এ পরিষ্কার বালুর জন্য প্রায়:

```
q_a ≈ 10 × N₆₀   (kPa, ২৫ mm settlement-এর জন্য, প্রায় ১ m চওড়া ফুটিং)
q_a ≈ 10 × 10 = 100 kPa
```

## ব্যবহৃত অ্যাজাম্পশন

- মাটি মূলত পরিষ্কার বালু, water table ফুটিংয়ের অনেক নিচে।
- ফুটিং ছোট (B ≈ ১ m), settlement সীমা ২৫ mm।
- Hammer efficiency ৫০% ধরা — মাঠের রিপোর্টে ভিন্ন হলে হিসাব বদলাবে।

## সীমাবদ্ধতা

- **কাদামাটিতে এই correlation চলে না।** Clay-এর জন্য undrained shear strength
  (`c_u`) ও bearing capacity factor ব্যবহার করতে হয়।
- Water table ফুটিংয়ের কাছে থাকলে capacity প্রায় অর্ধেক পর্যন্ত নামতে পারে।
- বড় ফুটিংয়ে (B > ১.২ m) একই N-এ allowable pressure কমে যায়, কারণ settlement
  বেশি গভীরতার মাটির উপর নির্ভর করে।
- একটি মাত্র borehole দিয়ে পুরো সাইট ধরা যায় না।

## পরবর্তী ধাপ

প্রাথমিক সাইজ পাওয়ার পর [আইসোলেটেড ফুটিংয়ের সাইজ যাচাই](/blog/isolated-footing-size-check-bangla)
দেখে service load ও ফুটিংয়ের নিজের ওজন মিলিয়ে চূড়ান্ত করুন।

@@@

---
slug: footing-punching-shear-check-bangla
title: ফুটিংয়ে punching shear চেক — যেখানে সবচেয়ে বেশি ভুল হয়
excerpt: Two-way shear ফুটিং ডিজাইনের সবচেয়ে সাধারণ নিয়ন্ত্রক শর্ত। critical section কোথায়, আর হিসাবটা ধাপে ধাপে কেমন।
categories: foundation-geotechnical|rcc-design-detailing
funnel_stage: consideration
search_intent: informational
days_ago: 7
meta_description: আইসোলেটেড ফুটিংয়ের punching (two-way) shear চেক — critical section, hand calculation ও সাধারণ ভুল।
---

## সরাসরি উত্তর

Punching shear-এর critical section কলামের মুখ থেকে **d/2** দূরে, চারদিক ঘিরে।
এখানে factored shear ওই perimeter-এর concrete capacity-র চেয়ে বেশি হলে ফুটিংয়ের
**গভীরতা বাড়াতে হবে** — rod বাড়িয়ে সমাধান হয় না।

## উদাহরণ

- কলাম: ৪০০ × ৪০০ mm
- ফুটিং: ২.৪ m × ২.৪ m
- Effective depth, `d` = ৪৫০ mm
- Factored column load, `P_u` = ১৪০০ kN
- `f'c` = ২৫ MPa

### ধাপ ১ — critical perimeter

```
b₀ = 4 × (কলামের বাহু + d)
   = 4 × (400 + 450) = 3400 mm
```

### ধাপ ২ — perimeter-এর ভেতরের অংশ বাদ

```
ভেতরের ক্ষেত্রফল = (0.85 m)² = 0.7225 m²
মোট ফুটিং ক্ষেত্রফল = 2.4 × 2.4 = 5.76 m²
নিট চাপ, q_u = 1400 / 5.76 = 243 kPa
V_u = 243 × (5.76 − 0.7225) = 243 × 5.0375 ≈ 1224 kN
```

### ধাপ ৩ — concrete capacity

বর্গাকার কলামে (β = ১) নিয়ন্ত্রক রাশি:

```
v_c = 0.33 × √f'c = 0.33 × √25 = 1.65 MPa
φV_c = 0.75 × 1.65 × 3400 × 450 / 1000 ≈ 1893 kN
```

### ধাপ ৪ — তুলনা

```
V_u = 1224 kN  <  φV_c = 1893 kN  → ঠিক আছে
```

## ব্যবহৃত অ্যাজাম্পশন

- Concentric load, কোনো moment transfer ধরা হয়নি।
- `φ = 0.75` (shear), normal-weight concrete।
- `d` সব দিকে সমান ধরা হয়েছে; বাস্তবে দুই দিকের rod-এর কারণে সামান্য পার্থক্য থাকে।

## সাধারণ ভুল

1. **Gross load দিয়ে হিসাব** — critical perimeter-এর ভেতরের চাপ বাদ দিতে হয়।
2. **Service load ব্যবহার** — punching চেক factored load-এ হয়।
3. **d/2 না ধরে কলামের মুখেই perimeter নেওয়া** — এতে capacity বেশি দেখায়।
4. **Moment transfer উপেক্ষা** — edge ও corner ফুটিংয়ে এটি নিয়ন্ত্রক হতে পারে।

## সীমাবদ্ধতা

উপরের হিসাব internal, concentric ফুটিংয়ের জন্য। Edge/corner ফুটিং, বা কলামে
উল্লেখযোগ্য moment থাকলে unbalanced moment-এর অংশ shear হিসেবে ধরতে হয় — সেটি
আলাদা এবং বেশি রক্ষণশীল হিসাব।

@@@

---
slug: development-length-lap-splice-bangla
title: Development length ও lap splice — সংখ্যা কোথা থেকে আসে
excerpt: কেন rod-কে একটা নির্দিষ্ট দৈর্ঘ্য কংক্রিটে ঢুকতেই হয়, সেই দৈর্ঘ্য কীভাবে বের করবেন, আর lap কোথায় দিলে সমস্যা।
categories: rcc-design-detailing
funnel_stage: awareness
search_intent: informational
days_ago: 10
meta_description: Development length ও lap splice length বের করার ধাপে ধাপে হিসাব, modification factor ও কোথায় lap দেওয়া উচিত নয়।
---

## সরাসরি উত্তর

Development length (`l_d`) হলো সেই দৈর্ঘ্য, যতটা কংক্রিটে ঢুকলে rod তার পুরো
yield strength ধরে রাখতে পারে। এর চেয়ে কম হলে rod টান খেয়ে **পিছলে বেরিয়ে আসে** —
rod ছিঁড়ে নয়। Lap splice হলো দুটি rod-এর মধ্যে সেই bond ভাগাভাগি।

## মূল রাশি

সরল আকারে, deformed bar-এর জন্য:

```
l_d = (f_y × ψ_t × ψ_e × ψ_s) / (1.1 × λ × √f'c × (c_b + K_tr)/d_b) × d_b
```

ব্যবহারিক কাজে `(c_b + K_tr)/d_b`-এর সর্বোচ্চ মান ২.৫ ধরা হয়, যা সবচেয়ে
সাধারণ পরিস্থিতি।

## উদাহরণ

- `f_y` = ৪২০ MPa, `f'c` = ২৫ MPa
- Bar: ১৬ mm deformed, নিচের স্তরে (top bar নয়)
- Normal-weight concrete, কোনো epoxy coating নেই
- `ψ_t = ψ_e = ψ_s = 1.0`, `λ = 1.0`, `(c_b + K_tr)/d_b = 2.5`

```
l_d = (420 × 1.0 × 1.0 × 1.0) / (1.1 × 1.0 × √25 × 2.5) × 16
    = 420 / (1.1 × 5 × 2.5) × 16
    = 420 / 13.75 × 16
    ≈ 30.5 × 16 ≈ 489 mm
```

অর্থাৎ প্রায় **৪৯০ mm**, যা মোটামুটি `31 d_b`।

### Top bar হলে

উপরের স্তরের rod-এর নিচে ৩০০ mm-এর বেশি fresh concrete থাকলে `ψ_t = 1.3`:

```
l_d = 489 × 1.3 ≈ 636 mm  → প্রায় 640 mm
```

## Lap splice

Class B splice (সবচেয়ে সাধারণ) = `1.3 × l_d`:

```
নিচের স্তরে: 1.3 × 489 ≈ 636 mm → 640 mm
```

## কোথায় lap দেবেন না

- **Beam-এর mid-span-এ bottom bar** — সেখানে টান সবচেয়ে বেশি।
- **Support-এর মুখে top bar** — একই কারণ, উল্টো দিকে।
- **একই section-এ সব rod একসাথে** — stagger করুন, অন্তত `l_d` ব্যবধানে।
- **Column-এর beam-column joint-এর ভেতরে**।

## ব্যবহৃত অ্যাজাম্পশন

- Deformed bar, uncoated, normal-weight concrete।
- পর্যাপ্ত cover ও confinement আছে ধরে `(c_b + K_tr)/d_b = 2.5`।
- Straight bar; hook ধরলে দৈর্ঘ্য কমে, সেটি আলাদা হিসাব।

## সীমাবদ্ধতা

প্রকৃত প্রকল্পে cover, bar spacing ও stirrup ঘনত্ব `(c_b + K_tr)/d_b` কমিয়ে দিতে
পারে, তাতে `l_d` বাড়ে। উপরের সংখ্যাগুলো একটি সাধারণ অনুকূল অবস্থার — নিজের
ডিটেইলে যাচাই করে নিন।

@@@

---
slug: slab-thickness-deflection-control-bangla
title: স্ল্যাবের পুরুত্ব — deflection দিয়েই ঠিক হয়, moment দিয়ে নয়
excerpt: বেশিরভাগ two-way স্ল্যাবে পুরুত্ব নির্ধারণ করে span/depth অনুপাত, strength নয়। সংখ্যা দিয়ে দেখানো হলো কেন।
categories: rcc-design-detailing|structural-engineering
funnel_stage: awareness
search_intent: informational
days_ago: 13
meta_description: Two-way slab এর minimum thickness span/depth অনুপাত দিয়ে বের করার হিসাব এবং deflection নিয়ন্ত্রণের যুক্তি।
---

## সরাসরি উত্তর

সাধারণ ভবনের স্ল্যাবে পুরুত্ব প্রায় সবসময় **deflection** দিয়ে নিয়ন্ত্রিত হয়।
প্রথমে span/depth নিয়ম দিয়ে পুরুত্ব ধরুন, তারপর সেই পুরুত্বে rod বের করুন —
উল্টোটা করলে বারবার হিসাব করতে হয়।

## উদাহরণ

একটি চারদিকে beam-এ বসা two-way স্ল্যাব:

- Clear span (দীর্ঘ দিক), `l_n` = ৫.৪ m
- Beam প্রস্থ ৩০০ mm
- `f_y` = ৪২০ MPa

### ধাপ ১ — exterior panel-এর জন্য minimum thickness

Beam-supported two-way slab-এ সাধারণ নিয়ম:

```
h_min = l_n / 33   (exterior panel, edge beam ছাড়া)
      = 5400 / 33 ≈ 164 mm
```

### ধাপ ২ — বাস্তব মান নেওয়া

১৬৪ mm থেকে বাড়িয়ে **১৭৫ mm** নেওয়া যায় — কাজ করা সহজ এবং cover ও দুই স্তরের
rod ধরার জায়গা থাকে।

### ধাপ ৩ — যাচাই

```
d = 175 − 20 (cover) − 10/2 (bar) ≈ 150 mm
l_n / d = 5400 / 150 = 36
```

Two-way action-এ এটি গ্রহণযোগ্য সীমার মধ্যে।

## ব্যবহৃত অ্যাজাম্পশন

- Two-way action আছে — অর্থাৎ `l_long / l_short ≤ 2`।
- সাধারণ আবাসিক live load, ভারী partition বা চলমান যন্ত্র নেই।
- `f_y = 420 MPa`; কম grade হলে সীমা কিছুটা শিথিল হয়।

## সীমাবদ্ধতা

- `l_long / l_short > 2` হলে এটি one-way স্ল্যাব — নিয়ম সম্পূর্ণ আলাদা।
- Flat plate (beam ছাড়া) হলে punching shear প্রায়ই পুরুত্ব নিয়ন্ত্রণ করে।
- Cantilever অংশে span/depth অনুপাত অনেক কম রাখতে হয়।
- ভারী partition বা ভঙ্গুর finish থাকলে আলাদা deflection হিসাব দরকার।

@@@

---
slug: column-tributary-area-load-bangla
title: Tributary area দিয়ে কলাম লোড — দ্রুত অথচ যথেষ্ট
excerpt: প্রাথমিক সাইজিংয়ের জন্য কলামে কত লোড আসছে তা tributary area দিয়ে বের করার ধাপ, এবং কোথায় এই পদ্ধতি ভুল করে।
categories: structural-engineering
funnel_stage: awareness
search_intent: informational
days_ago: 16
meta_description: Tributary area পদ্ধতিতে কলাম লোড বের করার হিসাব, floor অনুযায়ী accumulation এবং পদ্ধতির সীমাবদ্ধতা।
---

## সরাসরি উত্তর

Tributary area = কলামটির চারপাশের মেঝের সেই অংশ, যার ভার এই কলামে নামে। সাধারণ
নিয়মিত গ্রিডে প্রতিটি দিকের **অর্ধেক span** ধরলেই চলে।

## উদাহরণ

- গ্রিড: ৫.০ m × ৬.০ m, অভ্যন্তরীণ কলাম
- স্ল্যাব ১৭৫ mm, floor finish + ceiling ধরে dead load `D` = ৬.৫ kPa
- Live load `L` = ২.০ kPa (আবাসিক)
- Beam ও কলামের নিজস্ব ওজন আলাদা ধরা হবে
- ৬ তলা, প্রতি তলায় একই লোড

### ধাপ ১ — tributary area

```
A = (5.0 / 2 + 5.0 / 2) × (6.0 / 2 + 6.0 / 2) = 5.0 × 6.0 = 30 m²
```

### ধাপ ২ — প্রতি তলার লোড

```
D_floor = 6.5 × 30 = 195 kN
L_floor = 2.0 × 30 =  60 kN
```

Beam ও কলামের self weight আনুমানিক ১৫% ধরলে:

```
D_floor ≈ 195 × 1.15 ≈ 224 kN
```

### ধাপ ৩ — ৬ তলার জমা লোড

```
ΣD = 224 × 6 = 1344 kN
ΣL = 60 × 6  =  360 kN
```

### ধাপ ৪ — factored load

```
P_u = 1.2 D + 1.6 L = 1.2 × 1344 + 1.6 × 360 = 1613 + 576 ≈ 2189 kN
```

## Live load reduction

অনেক তলার জমা live load বাস্তবে একসাথে পুরোটা আসে না। কোড অনুযায়ী reduction
প্রযোজ্য হলে `ΣL` উল্লেখযোগ্য কমে। উপরের হিসাবে **কোনো reduction ধরা হয়নি**, তাই
এটি রক্ষণশীল দিকেই আছে।

## ব্যবহৃত অ্যাজাম্পশন

- নিয়মিত গ্রিড, সমান span, কোনো বড় opening নেই।
- Beam-এর ধারাবাহিকতা উপেক্ষা করা হয়েছে।
- Self weight ১৫% — প্রকৃত beam সাইজ জানার পর যাচাই করতে হবে।

## সীমাবদ্ধতা

- **অসম span** হলে tributary area পদ্ধতি ভুল করে; continuous beam-এর
  reaction হিসাব করতে হয়।
- **Cantilever বা transfer beam** থাকলে এটি একেবারেই চলবে না।
- Lateral load (wind/seismic) থেকে আসা axial ও moment এখানে ধরা হয়নি।
- চূড়ান্ত সাইজের জন্য analysis model থেকে reaction নিন।

@@@

---
slug: bnbc-load-combination-guide-bangla
title: Load combination — কোনটা কখন, আর কেন সবগুলো লাগে
excerpt: Strength design-এ ব্যবহৃত প্রধান combination গুলো, কোনটা কোন ধরনের member নিয়ন্ত্রণ করে, এবং সহজ ভুল।
categories: bnbc-code-application|structural-engineering
funnel_stage: consideration
search_intent: informational
days_ago: 19
meta_description: Strength design load combination সমূহ, কোন combination কোন member নিয়ন্ত্রণ করে এবং service vs factored load-এর পার্থক্য।
---

## সরাসরি উত্তর

একটি মাত্র combination দিয়ে ডিজাইন হয় না। **সব প্রযোজ্য combination চালিয়ে
সবচেয়ে খারাপ ফলাফল** নিতে হয় — এবং প্রতিটি member-এর জন্য "সবচেয়ে খারাপ" ভিন্ন
হতে পারে।

## প্রধান combination গুলো

Strength (ultimate) design-এ সাধারণত:

```
1.4 D
1.2 D + 1.6 L
1.2 D + 1.0 W + 1.0 L
1.2 D + 1.0 E + 1.0 L
0.9 D + 1.0 W
0.9 D + 1.0 E
```

## কোনটা কী ধরে

| Combination | সাধারণত কী নিয়ন্ত্রণ করে |
| --- | --- |
| `1.4 D` | খুব ভারী, কম live load-এর member (ছাদের গার্ডার, ট্যাংক) |
| `1.2 D + 1.6 L` | বেশিরভাগ beam, slab ও gravity column |
| `1.2 D + 1.0 W/E + 1.0 L` | Lateral system, শিয়ার ওয়াল, moment frame |
| `0.9 D + 1.0 W/E` | **Uplift ও overturning** — হালকা কাঠামো, ফুটিং |

## কেন `0.9 D` বাদ দেওয়া বিপজ্জনক

Dead load বেশিরভাগ সময় সাহায্য করে — এটি কাঠামোকে নিচে ধরে রাখে। কিন্তু বাস্তবে
dead load ধারণার চেয়ে **কম** হতে পারে (finish বসেনি, partition সরানো হয়েছে)।
`0.9 D` সেই কম-dead-load অবস্থাটাই পরীক্ষা করে। হালকা ছাদ বা বড় cantilever-এ
এই combination-ই প্রায়ই নিয়ন্ত্রক।

## Service না factored — কোথায় কোনটা

- **Factored load** → strength চেক (moment, shear, axial capacity)।
- **Service load** → bearing capacity, settlement, deflection, crack width।

ফুটিংয়ের সাইজ service load-এ বের হয়, কিন্তু ফুটিংয়ের rod ও পুরুত্ব factored
load-এ — এই দুটি গুলিয়ে ফেলা সবচেয়ে সাধারণ ভুল।

## সীমাবদ্ধতা

উপরের factor গুলো প্রচলিত strength-design অনুশীলনের। **প্রকল্পে প্রযোজ্য
কোড এডিশনের নিজস্ব তালিকা দেখে নিন** — snow, rain, soil pressure বা fluid
load থাকলে অতিরিক্ত combination যোগ হয়, এবং seismic ক্ষেত্রে overstrength
factor আলাদা করে ধরতে হতে পারে।

@@@

---
slug: concrete-cube-test-28-day-strength-bangla
title: কংক্রিট কিউব টেস্ট — ২৮ দিনের রিপোর্ট কীভাবে পড়বেন
excerpt: একটি কিউব ফেল করলেই ব্যাচ ফেল নয়। গ্রহণযোগ্যতার শর্ত, গড়ের নিয়ম, আর কম রেজাল্ট এলে পরের ধাপ।
categories: construction-quality
funnel_stage: awareness
search_intent: informational
days_ago: 22
meta_description: কংক্রিট কিউব টেস্টের ২৮ দিনের ফল ব্যাখ্যা, acceptance criteria, এবং কম strength এলে করণীয়।
---

## সরাসরি উত্তর

একটি নমুনা নির্ধারিত মানের নিচে এলেই কংক্রিট বাতিল হয় না। গ্রহণযোগ্যতা যাচাই হয়
**পরপর তিনটি টেস্টের গড়** এবং **একক টেস্টের সর্বনিম্ন সীমা** — দুটি শর্ত একসাথে।

## দুটি শর্ত

ধরা যাক নির্ধারিত `f'c` = ২৫ MPa। প্রচলিত acceptance:

1. পরপর তিনটি টেস্টের গড় ≥ `f'c` = ২৫ MPa
2. কোনো একক টেস্ট < `f'c − 3.5` = ২১.৫ MPa নয়

এখানে "একটি টেস্ট" মানে সাধারণত **একই নমুনা থেকে নেওয়া দুই বা তিনটি কিউবের গড়** —
একটি কিউব নয়।

## উদাহরণ

একটি ঢালাইয়ের পরপর তিনটি টেস্ট:

| টেস্ট | কিউব ১ | কিউব ২ | টেস্টের গড় |
| --- | --- | --- | --- |
| A | ২৬.৪ | ২৭.১ | ২৬.৮ |
| B | ২৩.৯ | ২৪.৭ | ২৪.৩ |
| C | ২৫.৮ | ২৬.২ | ২৬.০ |

```
তিন টেস্টের গড় = (26.8 + 24.3 + 26.0) / 3 = 25.7 MPa  ≥ 25   ✔
সর্বনিম্ন একক টেস্ট = 24.3 MPa  ≥ 21.5                        ✔
```

দুটি শর্তই মেটে — ব্যাচ **গ্রহণযোগ্য**, যদিও টেস্ট B নির্ধারিত মানের নিচে।

## কম রেজাল্ট এলে ধাপে ধাপে

1. **টেস্টের নিজেরই সমস্যা আছে কি না দেখুন** — curing, capping, machine
   calibration, নমুনার বয়স।
2. **রেকর্ড মিলিয়ে দেখুন** — কোন ট্রাক, কোন সময়, slump কত ছিল।
3. এখনো সন্দেহ থাকলে **core test** বা non-destructive পরীক্ষা।
4. তারপরই structural adequacy-র মূল্যায়ন — যা responsible engineer-এর কাজ।

## কিউব না সিলিন্ডার

বাংলাদেশে ১৫০ mm কিউব বহুল প্রচলিত, আবার ACI-ভিত্তিক ডিজাইনে ১৫০×৩০০ mm
সিলিন্ডার ধরা হয়। **দুটির মান এক নয়** — একই কংক্রিটে কিউবের রিডিং সিলিন্ডারের
চেয়ে বেশি আসে। ডিজাইনে যেটি ধরা হয়েছে, টেস্টও সেই ভিত্তিতেই ব্যাখ্যা করতে হবে।
স্পেসিফিকেশনে কোনটি লেখা আছে সেটি আগে নিশ্চিত করুন।

## সীমাবদ্ধতা

acceptance criteria প্রকল্পের স্পেসিফিকেশন ও প্রযোজ্য কোড এডিশনে ভিন্ন হতে পারে।
উপরের সংখ্যাগুলো প্রচলিত অনুশীলনের উদাহরণ — প্রকল্পের নিজস্ব শর্তই চূড়ান্ত।

@@@

---
slug: concrete-cover-exposure-bangla
title: কংক্রিট cover — সংখ্যাটা কেন এত গুরুত্বপূর্ণ
excerpt: Cover কম হলে কী হয়, exposure অনুযায়ী কত রাখতে হয়, এবং সাইটে cover ঠিক রাখার ব্যবহারিক উপায়।
categories: bnbc-code-application|construction-quality
funnel_stage: awareness
search_intent: informational
days_ago: 25
meta_description: Exposure অনুযায়ী কংক্রিট cover-এর মান, cover কম হলে corrosion ঝুঁকি এবং সাইটে cover নিয়ন্ত্রণের উপায়।
---

## সরাসরি উত্তর

Cover হলো rod-এর বাইরের পৃষ্ঠ থেকে কংক্রিটের বাইরের তল পর্যন্ত দূরত্ব। এটি দুটি
কাজ করে: **rod-কে মরিচা থেকে বাঁচায়** এবং **আগুনে সুরক্ষা দেয়**। কম হলে rod-এ
মরিচা ধরে, মরিচা ফুলে কংক্রিট ফাটিয়ে খসিয়ে দেয় — একবার শুরু হলে থামে না।

## প্রচলিত মান

| অবস্থা | সাধারণ cover |
| --- | --- |
| মাটির সাথে স্থায়ী সংস্পর্শ (ফুটিংয়ের নিচ) | ৭৫ mm |
| মাটি বা আবহাওয়ার সংস্পর্শে (retaining wall, ছাদের beam) | ৪০–৫০ mm |
| ভেতরের beam ও কলাম | ৪০ mm |
| ভেতরের স্ল্যাব ও দেয়াল | ২০–২৫ mm |
| উপকূলীয়/লবণাক্ত পরিবেশ | উপরের মানের চেয়ে বেশি |

## কেন উপকূলে বেশি

ক্লোরাইড আয়ন কংক্রিটের ভেতর দিয়ে ধীরে ধীরে rod পর্যন্ত পৌঁছায়। যাওয়ার পথ যত
লম্বা, সময় তত বেশি লাগে। Cover দ্বিগুণ করলে পৌঁছাতে লাগা সময় প্রায় **চারগুণ**
বাড়ে, কারণ diffusion দূরত্বের বর্গের সাথে সম্পর্কিত। উপকূলীয় এলাকায় বাড়তি
cover-এর যুক্তি এটাই।

## সাইটে cover ঠিক রাখার উপায়

- **Cover block ব্যবহার করুন** — ইটের টুকরো বা পাথর নয়। মর্টার বা প্লাস্টিকের
  তৈরি, একই grade-এর ব্লক।
- প্রতি বর্গমিটারে অন্তত ৪টি ব্লক; স্ল্যাবের top rod-এর জন্য chair দিন।
- ঢালাইয়ের আগে **cover চেক করে ছবি রাখুন** — পরে প্রমাণ থাকে।
- ঢালাইয়ের সময় শ্রমিক যেন rod-এর উপর সরাসরি না হাঁটে — walkway board দিন।

## সাধারণ ভুল

Beam-এ ৪০ mm cover ধরে ডিজাইন করা, অথচ সাইটে stirrup-এর বাইরে ২০ mm-ও নেই।
এতে effective depth `d` কমে যায় — অর্থাৎ beam-এর প্রকৃত সক্ষমতা হিসাবের চেয়ে
কম। ৫০০ mm গভীর beam-এ ২০ mm cover কমলে capacity প্রায় ৪% কমে; ২৫০ mm স্ল্যাবে
একই ভুলে ক্ষতি অনেক বেশি।

## সীমাবদ্ধতা

উপরের মানগুলো প্রচলিত অনুশীলনের সাধারণ পরিসর। **প্রকল্পে প্রযোজ্য কোড এডিশন ও
স্পেসিফিকেশনই চূড়ান্ত** — বিশেষ করে fire rating, aggressive chemical exposure বা
জল ধারণকারী কাঠামোর ক্ষেত্রে আলাদা শর্ত থাকে।

@@@

---
slug: bar-bending-schedule-steel-quantity-bangla
title: Bar bending schedule — স্টিলের পরিমাণ ধাপে ধাপে
excerpt: একটি beam-এর BBS তৈরি করে দেখানো হলো cutting length, hook, bend deduction আর ওজনের হিসাব কীভাবে মেলে।
categories: quantity-estimation|rcc-design-detailing
funnel_stage: consideration
search_intent: informational
days_ago: 28
meta_description: Bar bending schedule তৈরির ধাপ — cutting length, hook allowance, bend deduction এবং unit weight দিয়ে স্টিলের ওজন হিসাব।
---

## সরাসরি উত্তর

BBS-এর মূল কাজ প্রতিটি rod-এর **cutting length** বের করা। Cutting length =
পরিমাপ করা দৈর্ঘ্য + hook allowance − bend deduction। এরপর unit weight দিয়ে গুণ
করলেই ওজন।

## Unit weight

```
w (kg/m) = d² / 162      (d মিলিমিটারে)
```

| Bar | ওজন (kg/m) |
| --- | --- |
| ১০ mm | ০.৬১৭ |
| ১২ mm | ০.৮৮৯ |
| ১৬ mm | ১.৫৮০ |
| ২০ mm | ২.৪৭০ |
| ২৫ mm | ৩.৮৬০ |

## উদাহরণ — একটি beam

- Beam: ৩০০ × ৪৫০ mm, clear span ৫.০ m
- Cover ৪০ mm
- Bottom: ৩ টি ২০ mm, দুই প্রান্তে ৯০° bend
- Stirrup: ৮ mm @ ১৫০ mm c/c

### Bottom bar-এর cutting length

```
Clear span                    = 5000 mm
দুই পাশে support-এ ঢোকা 2 × 230 = 460 mm
মোট মাপা দৈর্ঘ্য               = 5460 mm

দুই প্রান্তে 90° bend, প্রতিটিতে 9d ধরে:
  bend দৈর্ঘ্য = 2 × 9 × 20 = 360 mm
দুই প্রান্তে bend deduction, প্রতিটিতে 2d:
  deduction  = 2 × 2 × 20 =  80 mm

Cutting length = 5460 + 360 − 80 = 5740 mm ≈ 5.74 m
```

তিনটি bar-এর ওজন:

```
3 × 5.74 × 2.470 = 42.5 kg
```

### Stirrup

```
Stirrup পরিধি = 2 × (300 − 2×40) + 2 × (450 − 2×40)
              = 2 × 220 + 2 × 370 = 1180 mm
দুই প্রান্তে 135° hook, প্রতিটি 10d = 10 × 8 = 80 mm
Cutting length = 1180 + 2 × 80 − 3 × 2 × 8 (bend deduction)
               = 1180 + 160 − 48 = 1292 mm ≈ 1.292 m

সংখ্যা = 5000 / 150 + 1 ≈ 35 টি
ওজন   = 35 × 1.292 × 0.395 ≈ 17.9 kg
```

### মোট

```
42.5 + 17.9 ≈ 60.4 kg   (top bar ও extra rod বাদে)
```

## ব্যবহৃত অ্যাজাম্পশন

- Bend allowance ৯d ও deduction ২d — এগুলো প্রচলিত ব্যবহারিক মান, কোডে বাধ্যতামূলক নয়।
- ১৩৫° hook-এ ১০d — stirrup-এর জন্য সাধারণ।
- ৮ mm bar-এর unit weight ০.৩৯৫ kg/m।
- Lap splice ধরা হয়নি; ১২ m-এর বেশি bar হলে lap যোগ করতে হবে।

## সীমাবদ্ধতা

Bend allowance ও deduction-এর মান প্রকল্পভেদে ভিন্ন ধরা হয়। ঠিকাদারের সাথে
**আগেই একটি মানদণ্ড ঠিক করে নিন** — নইলে একই ড্রয়িং থেকে দুই পক্ষ দুই রকম
পরিমাণ পাবে। Wastage সাধারণত আলাদা ৩–৫% হিসেবে যোগ হয়, উপরের হিসাবে তা নেই।

@@@

---
slug: concrete-volume-material-estimate-bangla
title: কংক্রিটের উপকরণ হিসাব — ১:২:৪ মিক্সে কত সিমেন্ট, বালু, খোয়া
excerpt: Wet volume থেকে dry volume, তারপর প্রতিটি উপকরণের পরিমাণ — একটি স্ল্যাবের উদাহরণ দিয়ে পুরো হিসাব।
categories: quantity-estimation
funnel_stage: awareness
search_intent: informational
days_ago: 31
meta_description: ১:২:৪ কংক্রিট মিক্সে সিমেন্ট, বালু ও খোয়ার পরিমাণ বের করার ধাপে ধাপে হিসাব, dry volume factor সহ।
---

## সরাসরি উত্তর

ভেজা কংক্রিটের আয়তনকে সরাসরি ভাগ করলে ভুল হয়। শুকনো উপকরণের ফাঁক ভরাট হয়ে
আয়তন কমে যায়, তাই **wet volume × ১.৫৪** করে dry volume নিতে হয়, তারপর অনুপাতে ভাগ।

## উদাহরণ

একটি স্ল্যাব: ৮.০ m × ৫.০ m × ০.১৭৫ m, মিক্স ১:২:৪।

### ধাপ ১ — wet ও dry volume

```
Wet volume = 8.0 × 5.0 × 0.175 = 7.0 m³
Dry volume = 7.0 × 1.54 = 10.78 m³
```

### ধাপ ২ — অনুপাতে ভাগ

```
মোট অংশ = 1 + 2 + 4 = 7

সিমেন্ট = 10.78 × 1/7 = 1.540 m³
বালু    = 10.78 × 2/7 = 3.080 m³
খোয়া    = 10.78 × 4/7 = 6.160 m³
```

### ধাপ ৩ — সিমেন্ট ব্যাগে

এক ব্যাগ (৫০ kg) সিমেন্টের আয়তন প্রায় ০.০৩৪৭ m³:

```
ব্যাগ = 1.540 / 0.0347 ≈ 44.4 → 45 ব্যাগ
```

### ধাপ ৪ — বালু ও খোয়া CFT-তে

```
1 m³ = 35.31 cft
বালু = 3.080 × 35.31 ≈ 109 cft
খোয়া = 6.160 × 35.31 ≈ 218 cft
```

### ধাপ ৫ — পানি

w/c = ০.৪৫ ধরলে:

```
সিমেন্টের ওজন = 45 × 50 = 2250 kg
পানি ≈ 2250 × 0.45 = 1012 লিটার
```

## ব্যবহৃত অ্যাজাম্পশন

- Dry volume factor ১.৫৪ — প্রচলিত ব্যবহারিক মান (১.৫২–১.৫৭ পরিসরে ধরা হয়)।
- ভলিউম ব্যাচিং। ওজনে ব্যাচিং করলে হিসাব আলাদা এবং বেশি নির্ভরযোগ্য।
- Wastage ধরা হয়নি; সাধারণত ৩–৫% যোগ করা হয়।
- w/c = ০.৪৫ একটি সাধারণ অনুমান — বাস্তবে workability ও mix design ঠিক করে।

## সীমাবদ্ধতা

১:২:৪-এর মতো nominal mix থেকে পাওয়া strength নিশ্চিত নয় — এটি উপকরণের মান,
gradation, ব্যাচিংয়ের নির্ভুলতা ও curing-এর উপর নির্ভর করে। **কাঠামোগত কংক্রিটে
design mix ও কিউব টেস্টই ভিত্তি**, nominal অনুপাত নয়। এই হিসাব উপকরণ সংগ্রহের
পরিকল্পনার জন্য, strength-এর প্রতিশ্রুতি হিসেবে নয়।

@@@

---
slug: autocad-layer-standard-bangla
title: AutoCAD লেয়ার স্ট্যান্ডার্ড — একটি ব্যবহারিক সেটআপ
excerpt: নাম দেওয়ার নিয়ম, lineweight পরিকল্পনা আর template হিসেবে সংরক্ষণ — যাতে প্রতিটি ড্রয়িং একই রকম প্রিন্ট হয়।
categories: autocad-productivity
funnel_stage: awareness
search_intent: informational
days_ago: 34
meta_description: স্ট্রাকচারাল ড্রয়িংয়ের জন্য AutoCAD লেয়ার নামকরণ, lineweight ও plot style-এর একটি ব্যবহারিক স্ট্যান্ডার্ড।
---

## কেন দরকার

লেয়ার স্ট্যান্ডার্ড না থাকলে প্রতিটি ড্রয়িং আলাদা দেখায়, প্রিন্টে line weight
এলোমেলো হয়, আর অন্য কারও ফাইল খুললে কোনটা কী বোঝা যায় না। এক ঘণ্টার সেটআপ
প্রতিটি প্রকল্পে সময় বাঁচায়।

## নামকরণের কাঠামো

```
S-BEAM-TEXT
│ │     └── উপাদান: OUTL / REIN / TEXT / DIM / HATCH
│ └──────── বস্তু: BEAM / COL / FOOT / SLAB / GRID / WALL
└────────── শাখা: S = Structural, A = Architectural
```

এভাবে নাম দিলে লেয়ার তালিকা নিজে থেকেই গুছিয়ে থাকে, আর `S-BEAM-*` লিখে
wildcard দিয়ে একসাথে সব beam লেয়ার বেছে নেওয়া যায়।

## একটি শুরুর সেট

| লেয়ার | রঙ | Lineweight | কাজ |
| --- | --- | --- | --- |
| `S-GRID` | ৮ (ধূসর) | ০.১৩ mm | গ্রিড লাইন ও bubble |
| `S-COL-OUTL` | ৩ (সবুজ) | ০.৩৫ mm | কলামের রূপরেখা |
| `S-BEAM-OUTL` | ৪ (সায়ান) | ০.২৫ mm | Beam-এর রূপরেখা |
| `S-FOOT-OUTL` | ২ (হলুদ) | ০.৩৫ mm | ফুটিংয়ের রূপরেখা |
| `S-REIN-MAIN` | ১ (লাল) | ০.৫০ mm | প্রধান rod |
| `S-REIN-SEC` | ৬ (ম্যাজেন্টা) | ০.২৫ mm | Stirrup, distribution rod |
| `S-TEXT` | ৭ (সাদা/কালো) | ০.১৮ mm | নোট ও লেবেল |
| `S-DIM` | ৮ (ধূসর) | ০.১৩ mm | ডাইমেনশন |
| `S-HATCH` | ৯ (হালকা ধূসর) | ০.০৯ mm | Section hatch |
| `DEFPOINTS` | — | প্লট হয় না | সহায়ক জ্যামিতি |

## Color-dependent না named plot style

এই সেটআপ **color-dependent (CTB)** ধরে সাজানো — রঙই lineweight ঠিক করে। এটি
বাংলাদেশে বেশি প্রচলিত এবং পুরনো ফাইলের সাথে মেলে। নতুন করে শুরু করলে
named (STB) style বেশি নমনীয়, কিন্তু দল ছোট হলে CTB-ই সহজ।

## Template হিসেবে সংরক্ষণ

1. একটি ফাঁকা ড্রয়িংয়ে উপরের লেয়ারগুলো তৈরি করুন।
2. Text style, dimension style ও একটি title block যোগ করুন।
3. `SAVEAS` → **AutoCAD Drawing Template (\*.dwt)**।
4. `OPTIONS` → Files → Template Settings-এ ডিফল্ট হিসেবে দিন।

এরপর প্রতিটি নতুন ড্রয়িং একই ভিত্তি থেকে শুরু হবে।

## দলের জন্য একটি নিয়ম

`LAYTRANS` (Layer Translator) দিয়ে বাইরে থেকে আসা ফাইলকে নিজেদের স্ট্যান্ডার্ডে
রূপান্তর করা যায়। ম্যাপিং একবার সংরক্ষণ করে রাখলে পরের বার এক ক্লিকেই হয়।

@@@

---
slug: mouza-map-scale-and-georeference-bangla
title: মৌজা ম্যাপ থেকে CAD — স্কেল ও অবস্থান ঠিক রাখার ধাপ
excerpt: স্ক্যান করা মৌজা শিট AutoCAD-এ এনে সঠিক স্কেলে বসানো, দাগের সীমানা তোলা এবং ক্ষেত্রফল যাচাইয়ের ব্যবহারিক পদ্ধতি।
categories: mouza-drawing-workflow|autocad-productivity
funnel_stage: consideration
search_intent: informational
days_ago: 37
meta_description: স্ক্যান করা মৌজা ম্যাপ AutoCAD-এ সঠিক স্কেলে বসানো, দাগ ট্রেস করা ও ক্ষেত্রফল মেলানোর ধাপে ধাপে পদ্ধতি।
---

## সরাসরি উত্তর

স্ক্যান করা শিট কখনোই আপনা থেকে সঠিক স্কেলে আসে না। ছবিটি বসিয়ে, একটি
**পরিচিত দূরত্ব** ধরে `SCALE` কমান্ডের `Reference` অপশন দিয়ে মেলাতে হয়।

## ধাপে ধাপে

### ১ — ছবি সংযুক্ত করুন

`IMAGEATTACH` (বা `ATTACH`) দিয়ে স্ক্যান বসান। **Insert করবেন না** — সংযুক্ত
রাখলে ফাইল হালকা থাকে এবং মূল স্ক্যান বদলালে ড্রয়িংও হালনাগাদ হয়।

### ২ — একটি পরিচিত দূরত্ব বেছে নিন

মৌজা শিটে সাধারণত একটি স্কেল বার থাকে, অথবা একটি দাগের মাপ জানা থাকে।
সবচেয়ে **লম্বা** পরিচিত দূরত্বটি বেছে নিন — ছোট দূরত্বে মাপার ভুল বেশি প্রভাব ফেলে।

### ৩ — Reference দিয়ে স্কেল করুন

```
SCALE → ছবি নির্বাচন → base point (পরিচিত রেখার এক প্রান্ত)
      → R (Reference)
      → রেখার দুই প্রান্ত ক্লিক করুন
      → প্রকৃত দৈর্ঘ্য টাইপ করুন (যেমন 200 ফুট হলে একক অনুযায়ী)
```

### ৪ — দ্বিতীয় দূরত্ব দিয়ে যাচাই

আরেকটি জানা দূরত্ব মেপে দেখুন। পার্থক্য ১%-এর মধ্যে থাকলে ঠিক আছে। বেশি হলে
স্ক্যানে বিকৃতি আছে।

### ৫ — দাগের সীমানা তুলুন

`PLINE` দিয়ে বন্ধ polyline আঁকুন, `S-PLOT-BDRY` জাতীয় আলাদা লেয়ারে। প্রতিটি
দাগ **আলাদা বন্ধ polyline** হতে হবে, নইলে ক্ষেত্রফল বের করা যাবে না।

### ৬ — ক্ষেত্রফল মেলান

`AREA` বা `LIST` দিয়ে ক্ষেত্রফল নিন এবং **রেকর্ডের ক্ষেত্রফলের সাথে মিলিয়ে দেখুন**।

## স্ক্যানের বিকৃতি নিয়ে

পুরনো কাগজ কুঁচকে যায় ও অসমভাবে সঙ্কুচিত হয়। ফলে শিটের এক কোণে স্কেল মিললেও
অন্য কোণে ২–৩% পর্যন্ত পার্থক্য থাকতে পারে। বড় শিটে একটি মাত্র scale factor
যথেষ্ট নয় — অঞ্চলভিত্তিক যাচাই করুন।

## গুরুত্বপূর্ণ সীমাবদ্ধতা

এই কাজের ফল একটি **ড্রয়িং**, আইনি জরিপ নয়। মৌজা ম্যাপ থেকে তোলা সীমানা ও
ক্ষেত্রফল সম্পত্তির আইনগত সীমানা নির্ধারণ করে না। জমির সীমানা, দখল বা মালিকানার
প্রশ্নে **লাইসেন্সপ্রাপ্ত আমিন/সার্ভেয়ারের মাঠ জরিপ** এবং সংশ্লিষ্ট ভূমি অফিসের
রেকর্ডই একমাত্র ভিত্তি।

@@@

---
slug: pile-capacity-static-formula-bangla
title: পাইলের ক্ষমতা — static formula দিয়ে প্রাথমিক হিসাব
excerpt: Skin friction ও end bearing আলাদা করে বোঝা, একটি bored pile-এর সংখ্যা দিয়ে হিসাব, এবং কেন load test বাদ দেওয়া যায় না।
categories: foundation-geotechnical
funnel_stage: consideration
search_intent: informational
days_ago: 40
meta_description: Bored pile-এর allowable capacity static formula দিয়ে বের করার ধাপ — skin friction, end bearing ও factor of safety।
---

## সরাসরি উত্তর

পাইলের ক্ষমতা দুই অংশের যোগফল: গায়ের ঘর্ষণ (**skin friction**) আর তলার ঠেকা
(**end bearing**)। লম্বা পাইলে ঘর্ষণই বেশিরভাগ ভার নেয় — তলার অবদান অনেক সময়
এক-চতুর্থাংশেরও কম।

```
Q_ult = Q_s + Q_b
Q_all = Q_ult / FS
```

## উদাহরণ

একটি bored pile, বালুময় স্তরে:

- ব্যাস `D` = ০.৬ m, দৈর্ঘ্য `L` = ১৮ m
- গড় `N₆₀` = ১৮ (গা বরাবর), তলায় `N₆₀` = ৩৫
- Factor of safety = ২.৫

### ধাপ ১ — skin friction

Bored pile-এ বালুর জন্য প্রচলিত অনুমান `f_s ≈ 2 N₆₀` (kPa):

```
f_s = 2 × 18 = 36 kPa
পার্শ্বতল ক্ষেত্রফল = π × 0.6 × 18 = 33.93 m²
Q_s = 36 × 33.93 ≈ 1221 kN
```

### ধাপ ২ — end bearing

Bored pile-এ প্রচলিত অনুমান `q_b ≈ 90 N₆₀` (kPa), সীমা প্রায় ৪৫০০ kPa:

```
q_b = 90 × 35 = 3150 kPa
তলার ক্ষেত্রফল = π × 0.6² / 4 = 0.283 m²
Q_b = 3150 × 0.283 ≈ 891 kN
```

### ধাপ ৩ — যোগফল ও allowable

```
Q_ult = 1221 + 891 = 2112 kN
Q_all = 2112 / 2.5 ≈ 845 kN
```

লক্ষ্য করুন: মোট ক্ষমতার প্রায় **৫৮%** এসেছে ঘর্ষণ থেকে।

## ব্যবহৃত অ্যাজাম্পশন

- পুরো দৈর্ঘ্যে মূলত বালু, কোনো নরম কাদার স্তর নেই।
- `f_s = 2N` ও `q_b = 90N` — bored pile-এর জন্য প্রচলিত রক্ষণশীল correlation।
  Driven pile-এ মান উল্লেখযোগ্য বেশি।
- Negative skin friction ধরা হয়নি।
- Group effect ধরা হয়নি — একক পাইলের হিসাব।

## কেন এটি চূড়ান্ত নয়

- **Pile group-এ efficiency ১-এর কম** — কাছাকাছি পাইল একে অপরের মাটি ভাগ করে।
- **Negative skin friction** — চারপাশের মাটি বসে গেলে ঘর্ষণ উল্টো দিকে কাজ করে,
  ক্ষমতা যোগ না হয়ে লোড যোগ হয়।
- **নির্মাণ পদ্ধতির প্রভাব** — bored pile-এ boring fluid, cleaning ও concreting
  পদ্ধতি প্রকৃত ঘর্ষণ অনেকটাই বদলে দেয়।
- **Static load test-ই একমাত্র সরাসরি প্রমাণ।** উপরের হিসাব সংখ্যা ও দৈর্ঘ্যের
  প্রাথমিক পরিকল্পনার জন্য; চূড়ান্ত গ্রহণযোগ্যতা test দিয়েই নির্ধারিত হয়।

@@@

---
slug: steel-connection-bolt-shear-bangla
title: বোল্ট কানেকশন — shear ও bearing চেক
excerpt: একটি সাধারণ শিয়ার কানেকশনে কয়টি বোল্ট লাগবে, এবং কেন bearing চেক প্রায়ই নিয়ন্ত্রক হয়।
categories: steel-design|structural-engineering
funnel_stage: consideration
search_intent: informational
days_ago: 43
meta_description: স্টিল কাঠামোর বোল্ট কানেকশনে shear capacity ও bearing capacity বের করার ধাপে ধাপে হিসাব।
---

## সরাসরি উত্তর

প্রতিটি বোল্টকে দুইভাবে ফেল করতে হতে পারে: বোল্ট নিজে কেটে যাওয়া (**shear**), বা
প্লেটের ছিদ্র লম্বা হয়ে যাওয়া (**bearing**)। দুটির মধ্যে **ছোট মানটিই** সেই
বোল্টের ক্ষমতা।

## উদাহরণ

- সংযোগ: ১০ mm gusset plate, একক shear plane
- বোল্ট: M২০, grade ৮.৮, thread shear plane-এ আছে
- প্লেট: `f_u` = ৪০০ MPa
- Factored shear = ২৪০ kN

### ধাপ ১ — একটি বোল্টের shear capacity

M২০-এর thread অংশে কার্যকর ক্ষেত্রফল প্রায় ২৪৫ mm²। Grade ৮.৮-এ
`f_ub` = ৮০০ MPa:

```
V_b = 0.6 × 800 × 245 / 1000 = 117.6 kN
φV_b = 0.75 × 117.6 ≈ 88 kN
```

### ধাপ ২ — bearing capacity

```
R_b = 2.4 × d × t × f_u = 2.4 × 20 × 10 × 400 / 1000 = 192 kN
φR_b = 0.75 × 192 = 144 kN
```

### ধাপ ৩ — নিয়ন্ত্রক মান ও সংখ্যা

```
প্রতি বোল্টের ক্ষমতা = min(88, 144) = 88 kN
প্রয়োজনীয় সংখ্যা = 240 / 88 = 2.7 → 3 টি বোল্ট
```

এখানে **shear** নিয়ন্ত্রক। প্লেট পাতলা হলে (যেমন ৬ mm) bearing নেমে
`0.75 × 2.4 × 20 × 6 × 400 / 1000 = 86 kN` হতো — তখন bearing নিয়ন্ত্রক হয়ে যেত।

## ব্যবহৃত অ্যাজাম্পশন

- Bearing-type connection, slip-critical নয়।
- Thread shear plane-এর ভেতরে — বাইরে থাকলে ক্ষমতা প্রায় ২৫% বেশি।
- প্রান্তিক দূরত্ব ও ব্যবধান কোডের ন্যূনতম মেনেছে ধরে `2.4 d t f_u` ব্যবহার;
  edge distance কম হলে এই মান কমে।
- `φ = 0.75`।

## যা আলাদা করে চেক করতে হবে

- **Block shear** — বোল্ট গ্রুপের চারপাশে প্লেট ছিঁড়ে বেরিয়ে যাওয়া।
- **Net section rupture** — ছিদ্রের কারণে কমে যাওয়া প্রস্থচ্ছেদ।
- **প্রান্তিক দূরত্ব ও ব্যবধান** — ন্যূনতম ও সর্বোচ্চ, দুটিই।
- সংযোগে moment বা eccentricity থাকলে বোল্টে অসম ভাগ পড়ে।

## সীমাবদ্ধতা

উপরের সংখ্যা LRFD ধাঁচের প্রচলিত অনুশীলনের। প্রকল্পে প্রযোজ্য কোড এডিশনের
নিজস্ব factor ও কার্যকর ক্ষেত্রফলের সংজ্ঞা দেখে নিন — বিশেষ করে বোল্টের grade ও
কার্যকর ক্ষেত্রফলের মান প্রস্তুতকারকভেদে ভিন্ন হতে পারে।
