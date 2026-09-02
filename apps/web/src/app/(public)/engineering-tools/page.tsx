import type { Metadata } from 'next';
import Link from 'next/link';
import type { DownloadAsset, Product, SiteSettings } from '@nuruzzaman/contracts';

import { AddToCart } from '@/features/catalog/add-to-cart';
import { PRODUCT_FAQ } from '@/features/catalog/product-faq';
import { MODULE_COUNT, PRODUCT_MODULES } from '@/features/catalog/product-modules';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container, Section } from '@/components/ui/container';
import { Prose } from '@/components/ui/prose';
import { tryPublicApi } from '@/lib/api/server';
import {
  breadcrumbSchema,
  buildMetadata,
  faqSchema,
  jsonLd,
  productSchema,
  softwareApplicationSchema,
} from '@/lib/seo';
import { supportNav } from '@/lib/site';

// Title and description are the owner's own, from the product document. The
// AutoCAD version numbers are deliberately left out of the title: which
// releases the current build supports is still unconfirmed, and a title is the
// last place to put a claim that might be wrong.
export const metadata: Metadata = buildMetadata({
  title:
    'NB Engineering Tools for AutoCAD | Structural Design, Footing, Pile Cap, Beam & Slab Automation Software',
  description:
    'AutoCAD-এর জন্য professional engineering automation suite — footing, combined footing, pile cap, beam, slab, column, grid, geotechnical, reinforcement ও estimate workflow। ২৬টি compiled VLX module, machine activation ও token licensing। ডেভেলপার: Engr. Md. Nuruzzaman, RSE।',
  path: '/engineering-tools',
});

/** Facts stated in the owner's published product document, and nothing else. */
const VERIFIED_FACTS = [
  'NB Engineering Tools v6.0',
  'Structural & Engineering Design Tools for AutoCAD',
  'Windows 10 / 11, 64-bit',
  '২৫টি engineering/productivity মডিউল + ১টি core/security মডিউল = মোট ২৬টি compiled VLX মডিউল',
  'AutoCAD Ribbon এবং classic pull-down menu',
  'Machine activation, token/credit licensing, signed activation ও refill workflow',
  'Professional Windows Setup EXE',
  'Vendor-verified license recovery',
  'ডেভেলপার: Engr. Md. Nuruzzaman, RSE',
];

const GROUP_ORDER = [
  'Layout, Grid & Schedule',
  'Footing & Foundation',
  'Geotechnical',
  'Beam & Slab',
  'Dimension Utilities',
  'Mouza & OCR',
  'License & System',
];

const INSTALL_STEPS = [
  'Machine ID নিন',
  'লাইসেন্স ক্রয় ও অ্যাক্টিভেশন সম্পন্ন করুন',
  'Signed activation key প্রয়োগ করুন',
  'প্রয়োজন অনুযায়ী token refill নিন',
  'ইঞ্জিনিয়ারিং টুল ব্যবহার শুরু করুন',
];

export default async function EngineeringToolsPage() {
  const [product, release, settings] = await Promise.all([
    tryPublicApi<{ data: Product }>('/products/nb-engineering-tools', {
      tags: ['products', 'product:nb-engineering-tools'],
    }),
    tryPublicApi<{ data: DownloadAsset }>('/releases/nb-engineering-tools-v6', {
      tags: ['releases'],
    }),
    tryPublicApi<{ data: SiteSettings }>('/site/settings', { tags: ['settings'] }),
  ]);

  const tools = product?.data ?? null;
  const tested = settings?.data?.product?.tested_autocad_versions ?? null;
  const designedFor = settings?.data?.product?.designed_for ?? 'AutoCAD 2024';
  const supportEmail = settings?.data?.support_email ?? null;

  const cheapest = (tools?.variants ?? [])
    .map((variant) => variant.price)
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => a.amount_minor - b.amount_minor)[0];

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    modules: PRODUCT_MODULES.filter((module) => module.group === group),
  })).filter((entry) => entry.modules.length > 0);

  const schemas = [
    breadcrumbSchema([
      { name: 'হোম', path: '/' },
      { name: 'ইঞ্জিনিয়ারিং টুলস', path: '/engineering-tools' },
    ]),
    softwareApplicationSchema({
      name: 'NB Engineering Tools',
      description: 'Structural & Engineering Design Tools for AutoCAD',
      version: release?.data?.version ?? null,
      operatingSystem: 'Windows 10, Windows 11',
      path: '/engineering-tools',
      price: cheapest ?? null,
    }),
    faqSchema(PRODUCT_FAQ),
    ...(tools
      ? [
          productSchema({
            name: tools.name,
            slug: tools.slug,
            tagline: tools.tagline,
            cover_url: tools.cover_url,
            price: cheapest ?? null,
          }),
        ]
      : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />

      <Container className="pt-10">
        <Breadcrumbs
          trail={[
            { name: 'হোম', path: '/' },
            { name: 'ইঞ্জিনিয়ারিং টুলস', path: '/engineering-tools' },
          ]}
        />
      </Container>

      <Section tone="white" className="pt-8">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <Badge tone="warning">NB Engineering Tools v6.0</Badge>
              <h1 className="mt-3 text-[length:var(--step-h1)] leading-tight font-bold text-navy">
                Structural &amp; Engineering Design Tools for AutoCAD
              </h1>
              <p className="mt-4 text-lg text-muted">
                Footing, combined footing, pile cap, beam, slab, column, grid ও geotechnical
                workflow-এর জন্য একটি professional AutoCAD automation suite। Ribbon এবং classic
                pull-down menu — দুইভাবেই কাজ করে।
              </p>

              <Callout tone="warning" className="mt-6">
                <p>
                  <strong>সামঞ্জস্য:</strong> মালিকের প্রকাশিত নথি অনুযায়ী বর্তমান commercial
                  build {designedFor}, Windows 10/11 64-bit-এর জন্য প্রস্তুত।
                </p>
                <p className="mt-2">
                  {tested
                    ? `রানটাইম-টেস্ট করা ভার্সন: ${tested}।`
                    : 'ভিন্ন AutoCAD ভার্সনের সামঞ্জস্য আলাদাভাবে নিশ্চিত করতে হবে। রানটাইম-টেস্টের প্রমাণ ছাড়া কোনো ভার্সনকে পরীক্ষিত বলা হয় না।'}
                </p>
              </Callout>

              <section className="mt-10">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">যাচাই করা তথ্য</h2>
                <ul className="mt-4 space-y-2 text-sm">
                  {VERIFIED_FACTS.map((fact) => (
                    <li key={fact} className="flex gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-teal"
                      />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-12">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
                  মডিউল তালিকা
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {MODULE_COUNT}টি compiled মডিউল, কাজ অনুযায়ী সাজানো। নিচে প্রতিটি মডিউলের
                  ঘোষিত ব্যবহার লেখা আছে — ভেতরের কমান্ডের নির্ভুলতা, গতি বা কোড-সামঞ্জস্য নিয়ে
                  এমন কোনো দাবি করা হচ্ছে না যা পরীক্ষা করা হয়নি।
                </p>

                <div className="mt-6 space-y-8">
                  {grouped.map((entry) => (
                    <div key={entry.group}>
                      <h3 className="font-latin text-sm font-bold tracking-wide text-teal uppercase">
                        {entry.group}
                      </h3>
                      <dl className="mt-3 divide-y divide-line rounded-[--radius-card] border border-line">
                        {entry.modules.map((module) => (
                          <div
                            key={module.name}
                            className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
                          >
                            <dt className="font-latin text-sm font-bold text-navy">
                              {module.name}
                            </dt>
                            <dd className="text-sm text-muted">{module.purpose}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs text-muted">
                  মডিউলের কার্যকারিতা ভার্সন অনুযায়ী পরিবর্তিত ও উন্নত হতে পারে।
                </p>
              </section>

              <section className="mt-12">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
                  লাইসেন্স, Machine ID ও টোকেন
                </h2>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Card className="p-5">
                    <h3 className="font-bold text-navy">Machine activation</h3>
                    <p className="mt-2 text-sm text-muted">
                      প্রতিটি সমর্থিত কম্পিউটার একটি Machine ID তৈরি করে এবং লাইসেন্স তার সাথে
                      bind হয়।
                    </p>
                    <p className="font-latin mt-3 rounded-md bg-surface px-3 py-2 text-xs text-navy">
                      NBM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
                    </p>
                  </Card>

                  <Card className="p-5">
                    <h3 className="font-bold text-navy">Token / credit</h3>
                    <p className="mt-2 text-sm text-muted">
                      Activation ব্যবহারের অনুমতি দেয়; token নির্দিষ্ট paid operation চালানোর
                      ক্রেডিট। সক্রিয় লাইসেন্স থাকলেও paid operation-এর জন্য পর্যাপ্ত token
                      লাগতে পারে।
                    </p>
                  </Card>
                </div>

                <h3 className="mt-8 font-bold text-navy">টোকেন কীভাবে খরচ হয়</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  <li>প্রতিটি টুলের token cost এক নয়।</li>
                  <li>কিছু টুল সফল command session অনুযায়ী charge করে।</li>
                  <li>
                    কিছু design টুল সফল <strong>unique design</strong> অনুযায়ী charge করে —
                    যেমন ২৪টি ফুটিং নির্বাচন করেও unique design ২টি হলে ২টিই গোনা হয়।
                  </li>
                  <li>বাতিল বা ব্যর্থ operation-এ প্রযোজ্য টুলের যুক্তি অনুযায়ী charge না-ও হতে পারে।</li>
                </ul>

                <Callout tone="warning" className="mt-6">
                  <p>
                    <strong>Windows reinstall বা format:</strong> স্থানীয় license/token ডেটা
                    মুছে যেতে পারে। Token শূন্য হয়ে গেলে আগের token স্বয়ংক্রিয়ভাবে ফিরে পাওয়ার
                    নিশ্চয়তা নেই।
                  </p>
                  <p className="mt-2">
                    Windows setup-এর সর্বোচ্চ ৩০ মিনিট আগে তোলা স্পষ্ট screenshot থাকলে ভেন্ডর
                    যাচাইয়ের পর অবশিষ্ট balance পুনরায় issue করা যেতে পারে। বিস্তারিত শর্ত ও
                    ব্যতিক্রম{' '}
                    <Link href="/support/license-recovery" className="text-blue underline">
                      লাইসেন্স রিকভারি পাতায়
                    </Link>{' '}
                    দেখুন।
                  </p>
                </Callout>
              </section>

              <section className="mt-12">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">ইনস্টলেশন</h2>
                <p className="font-latin mt-3 rounded-[--radius-card] border border-line bg-surface px-4 py-3 text-sm text-navy">
                  Welcome → System Check → License Agreement → Install → Finish
                </p>
                <p className="mt-3 text-sm text-muted">
                  ইনস্টল শেষে AutoCAD চালু করলে NB Engineering Tools Ribbon পাওয়া যায়। এরপর:
                </p>
                <ol className="mt-4 space-y-2 text-sm">
                  {INSTALL_STEPS.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="font-latin flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-soft text-xs font-bold text-blue">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>

              {tools?.description_html ? (
                <Prose html={tools.description_html} className="mt-12" />
              ) : null}

              <section className="mt-12">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
                  সাধারণ জিজ্ঞাসা
                </h2>
                <dl className="mt-5 divide-y divide-line rounded-[--radius-card] border border-line">
                  {PRODUCT_FAQ.map((item) => (
                    <div key={item.question} className="px-5 py-4">
                      <dt className="font-bold text-navy">{item.question}</dt>
                      <dd className="mt-1.5 text-sm text-muted">{item.answer}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <Callout tone="info" className="mt-10">
                <p>
                  <strong>ইঞ্জিনিয়ারিং দায়িত্ব:</strong> সফটওয়্যারটি design ও drawing automation
                  দেয়, কিন্তু চূড়ান্ত engineering সিদ্ধান্ত, ডিজাইন যাচাই, কোড সঙ্গতি, কাঠামোগত
                  নিরাপত্তা ও ড্রয়িংয়ের নির্ভুলতার দায়িত্ব যোগ্য প্রকৌশলীর। কোনো স্বয়ংক্রিয়
                  ফলাফল স্বাধীন engineering review ছাড়া চূড়ান্ত নির্মাণ-সিদ্ধান্ত হিসেবে ব্যবহার
                  করা উচিত নয়।
                </p>
              </Callout>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Card className="p-6">
                {tools ? (
                  <AddToCart variants={tools.variants ?? []} />
                ) : (
                  <Callout tone="info">
                    পণ্যের তথ্য লোড করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।
                  </Callout>
                )}

                <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">ভার্সন</dt>
                    <dd className="font-latin font-medium text-navy">
                      {release?.data?.version ?? 'v6.0'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">প্ল্যাটফর্ম</dt>
                    <dd className="font-latin font-medium text-navy">Windows 10 / 11, 64-bit</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">মডিউল</dt>
                    <dd className="font-latin font-medium text-navy">{MODULE_COUNT}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">SHA-256</dt>
                    <dd className="font-latin mt-1 break-all text-xs text-navy">
                      {release?.data?.checksum_sha256 ?? 'ফাইল প্রকাশের পর দেওয়া হবে'}
                    </dd>
                  </div>
                </dl>

                <ul className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
                  {supportNav.slice(0, 4).map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="text-blue hover:underline">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                {supportEmail ? (
                  <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
                    টেকনিক্যাল ও লাইসেন্স সাপোর্ট:{' '}
                    <a href={`mailto:${supportEmail}`} className="font-latin text-blue hover:underline">
                      {supportEmail}
                    </a>
                  </p>
                ) : null}
              </Card>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}
