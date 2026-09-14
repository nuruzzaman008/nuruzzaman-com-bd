import Link from 'next/link';
import type { DownloadAsset, Product, SiteSettings } from '@nuruzzaman/contracts';

import { AddToCart } from '@/features/catalog/add-to-cart';
import { CreditGuide } from '@/features/catalog/credit-guide';
import { productFaq } from '@/features/catalog/product-faq';
import { MODULE_COUNT, PRODUCT_MODULES } from '@/features/catalog/product-modules';
import {
  ToolsInstallation,
  ToolsLicensing,
  ToolsOverview,
  ToolsResponsibility,
  ToolsWorkflows,
} from '@/features/catalog/tools-article';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container, Section } from '@/components/ui/container';
import { tryPublicApi } from '@/lib/api/server';
import { localizePath, type Locale } from '@/lib/i18n/locale';
import { pageDictionary } from '@/lib/i18n/page';
import {
  breadcrumbSchema,
  faqSchema,
  jsonLd,
  productSchema,
  softwareApplicationSchema,
} from '@/lib/seo';
import { navItemLabel, supportNav } from '@/lib/site';

/** The product whose page carries the one complete NB Engineering Tools article. */
export const TOOLS_SLUG = 'nb-engineering-tools';

/** Where that article lives - the page the main menu's Engineering Tools item opens. */
export const TOOLS_PATH = `/products/${TOOLS_SLUG}`;

/** Title and description from the owner's product document. */
export const TOOLS_METADATA = {
  title:
    'NB Engineering Tools for AutoCAD 2024–2027 | Structural Design, Footing, Pile Cap, Beam & Slab Automation Software',
  description:
    'AutoCAD 2024–2027-এর জন্য professional engineering automation suite — footing, combined footing, pile cap, beam, slab, column, grid, geotechnical, reinforcement ও estimate workflow। ২৬টি compiled VLX module, machine activation ও NB Credits। ডেভেলপার: Engr. Md. Nuruzzaman, RSE।',
};

const GROUP_ORDER = [
  'Layout, Grid & Schedule',
  'Footing & Foundation',
  'Geotechnical',
  'Beam & Slab',
  'Dimension Utilities',
  'Mouza & OCR',
  'License & System',
];

/** The article's sections in page order, for the contents list. */
const CONTENTS = [
  { id: 'overview', bn: 'NB Engineering Tools কী', en: 'What it is' },
  { id: 'workflows', bn: 'প্রধান workflow', en: 'Main workflows' },
  { id: 'modules', bn: 'মডিউল তালিকা', en: 'Module list' },
  { id: 'licensing', bn: 'লাইসেন্স ও NB Credits', en: 'Licences and NB Credits' },
  { id: 'installation', bn: 'ইনস্টলেশন', en: 'Installation' },
  { id: 'faq', bn: 'সাধারণ জিজ্ঞাসা', en: 'FAQ' },
  { id: 'credit-pricing', bn: 'দাম ও কেনার নিয়ম', en: 'Prices and how to buy' },
];

/**
 * The NB Engineering Tools product page: the one complete article about the
 * software, with its prices and the cart beside it. Prices and packs come from
 * the catalogue, so a price changed in the dashboard shows here as it is.
 */
export async function EngineeringToolsArticle({
  locale,
  tools,
}: {
  locale: Locale;
  tools: Product;
}) {
  const { locale: active, t } = pageDictionary(locale);
  const en = active === 'en';
  const faq = productFaq(active);
  const [release, settings] = await Promise.all([
    tryPublicApi<{ data: DownloadAsset }>('/releases/nb-engineering-tools-v6', {
      tags: ['releases'],
    }),
    tryPublicApi<{ data: SiteSettings }>('/site/settings', { tags: ['settings'] }),
  ]);

  const supportEmail = settings?.data?.support_email ?? null;
  const variants = tools.variants ?? [];
  const launch = variants.find((variant) => (variant.device_limit ?? 1) === 1)?.price
    ?.compare_at_minor;

  const cheapest = variants
    .map((variant) => variant.price)
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => a.amount_minor - b.amount_minor)[0];

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    modules: PRODUCT_MODULES.filter((module) => module.group === group),
  })).filter((entry) => entry.modules.length > 0);

  const trail = [
    { name: t.common.home, path: '/' },
    { name: t.shop.heading, path: '/products' },
    { name: 'NB Engineering Tools', path: TOOLS_PATH },
  ];

  const schemas = [
    breadcrumbSchema(trail),
    softwareApplicationSchema({
      name: 'NB Engineering Tools',
      description: 'Structural & Engineering Design Tools for AutoCAD',
      version: release?.data?.version ?? null,
      operatingSystem: 'Windows 10, Windows 11',
      path: TOOLS_PATH,
      price: cheapest ?? null,
    }),
    faqSchema(faq),
    productSchema({
      name: tools.name,
      slug: tools.slug,
      tagline: tools.tagline,
      cover_url: tools.cover_url,
      price: cheapest ?? null,
    }),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />

      <Container className="pt-10">
        <Breadcrumbs trail={trail} />
      </Container>

      <Section tone="white" className="pt-8">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <article>
              <Badge tone="warning">NB Engineering Tools v6.0</Badge>
              <h1 className="mt-3 text-[length:var(--step-h1)] leading-tight font-bold text-navy">
                NB Engineering Tools for AutoCAD
              </h1>
              <p className="font-latin mt-2 text-xl font-semibold text-teal">
                Structural &amp; Engineering Design Tools
              </p>
              <p className="mt-4 text-lg text-muted">{t.tools.lede}</p>

              <p className="mt-4 rounded-[--radius-card] border border-line bg-surface px-4 py-3 text-sm text-navy">
                <strong>{en ? 'Supported:' : 'সমর্থিত:'}</strong>{' '}
                {en
                  ? 'AutoCAD 2024, 2025, 2026 and 2027 · Windows 10/11, 64-bit'
                  : 'AutoCAD 2024, 2025, 2026 ও 2027 · Windows 10/11, 64-bit'}
              </p>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                <Link href="#credit-pricing" className="text-blue underline">
                  {en ? 'Prices and how to buy' : 'দাম ও কেনার নিয়ম'}
                </Link>
                <Link href="/connect-autocad" className="text-blue underline">
                  {en
                    ? 'Connect AutoCAD for online activation and refills'
                    : 'Online activation ও refill-এর জন্য AutoCAD সংযোগ করুন'}
                </Link>
              </div>

              <nav
                aria-label={en ? 'On this page' : 'এই পাতায়'}
                className="mt-8 rounded-[--radius-card] border border-line p-4"
              >
                <p className="text-sm font-bold text-navy">{en ? 'On this page' : 'এই পাতায়'}</p>
                <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {CONTENTS.map((item, index) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className="text-blue hover:underline">
                        <span className="font-latin text-muted">{index + 1}.</span>{' '}
                        {en ? item.en : item.bn}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              <ToolsOverview locale={active} />
              <ToolsWorkflows locale={active} />

              <section id="modules" className="mt-12 scroll-mt-24">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
                  {t.tools.moduleList}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {MODULE_COUNT}
                  {t.tools.moduleIntro}
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
                            <dd data-authored="true" className="text-sm text-muted">
                              {en ? (module.purposeEn ?? module.purpose) : module.purpose}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs text-muted">{t.tools.moduleNote}</p>
              </section>

              <ToolsLicensing locale={active} />
              <ToolsInstallation locale={active} />

              <section id="faq" className="mt-12 scroll-mt-24">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">{t.tools.faq}</h2>
                <dl className="mt-5 divide-y divide-line rounded-[--radius-card] border border-line">
                  {faq.map((item) => (
                    <div key={item.question} className="px-5 py-4">
                      <dt className="font-bold text-navy">{item.question}</dt>
                      <dd className="mt-1.5 text-sm text-muted">{item.answer}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <ToolsResponsibility locale={active} />
            </article>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Card className="p-6">
                {variants.length ? (
                  <>
                    <AddToCart variants={variants} />
                    <p className="mt-3 text-xs text-muted">
                      {launch
                        ? en
                          ? 'Single-PC launch price for the first 100 engineers. It includes 1,000 NB Credits, issued after activation.'
                          : '১টি PC-র লঞ্চ দাম, প্রথম ১০০ জন ইঞ্জিনিয়ারের জন্য। সাথে 1,000 NB Credits, activation-এর পর issue করা হয়।'
                        : en
                          ? 'A single-PC licence includes 1,000 NB Credits, issued after activation.'
                          : '১টি PC-র লাইসেন্সের সাথে 1,000 NB Credits, activation-এর পর issue করা হয়।'}
                    </p>
                  </>
                ) : (
                  <Callout tone="info">{t.tools.loadFailed}</Callout>
                )}

                <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t.tools.version}</dt>
                    <dd className="font-latin font-medium text-navy">
                      {release?.data?.version ?? 'v6.0'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">AutoCAD</dt>
                    <dd className="font-latin font-medium text-navy">2024–2027</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t.tools.platform}</dt>
                    <dd className="font-latin font-medium text-navy">Windows 10 / 11, 64-bit</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t.tools.modules}</dt>
                    <dd className="font-latin font-medium text-navy">{MODULE_COUNT}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Installer</dt>
                    <dd className="font-latin font-medium text-navy">
                      {en ? '4 (AutoCAD 2024–2027)' : '৪টি (AutoCAD 2024–2027)'}
                    </dd>
                  </div>
                </dl>

                <ul className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
                  {supportNav.slice(0, 4).map((item) => (
                    <li key={item.href}>
                      <Link
                        href={localizePath(item.href, active)}
                        className="text-blue hover:underline"
                      >
                        {navItemLabel(item, t)}
                      </Link>
                    </li>
                  ))}
                </ul>

                {supportEmail ? (
                  <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
                    {t.tools.supportLine}{' '}
                    <a
                      href={`mailto:${supportEmail}`}
                      className="font-latin text-blue hover:underline"
                    >
                      {supportEmail}
                    </a>
                  </p>
                ) : null}
              </Card>
            </aside>
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <CreditGuide locale={active} />
        </Container>
      </Section>
    </>
  );
}
