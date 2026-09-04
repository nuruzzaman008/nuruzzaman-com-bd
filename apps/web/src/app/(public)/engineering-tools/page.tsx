import type { Metadata } from 'next';
import Link from 'next/link';
import type { DownloadAsset, Product, SiteSettings } from '@nuruzzaman/contracts';

import { AddToCart } from '@/features/catalog/add-to-cart';
import { productFaq } from '@/features/catalog/product-faq';
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
import { navItemLabel, supportNav } from '@/lib/site';
import { localizePath } from '@/lib/i18n/locale';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';

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
const GROUP_ORDER = [
  'Layout, Grid & Schedule',
  'Footing & Foundation',
  'Geotechnical',
  'Beam & Slab',
  'Dimension Utilities',
  'Mouza & OCR',
  'License & System',
];

export default async function EngineeringToolsPage({ locale }: LocalizedPageProps) {
  const { locale: active, t } = pageDictionary(locale);
  const faq = productFaq(active);
  const [product, release, settings] = await Promise.all([
    tryPublicApi<{ data: Product }>('/products/nb-engineering-tools', {
      query: { locale: active },
      tags: ['products', 'product:nb-engineering-tools', `product-locale:${active}`],
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
      { name: t.common.home, path: '/' },
      { name: t.tools.heading, path: '/engineering-tools' },
    ]),
    softwareApplicationSchema({
      name: 'NB Engineering Tools',
      description: 'Structural & Engineering Design Tools for AutoCAD',
      version: release?.data?.version ?? null,
      operatingSystem: 'Windows 10, Windows 11',
      path: '/engineering-tools',
      price: cheapest ?? null,
    }),
    faqSchema(faq),
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
            { name: t.common.home, path: '/' },
            { name: t.tools.heading, path: '/engineering-tools' },
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
                {t.tools.lede}
              </p>

              <Callout tone="warning" className="mt-6">
                <p>
                  <strong>{t.tools.compatibilityLabel}</strong> {t.tools.compatibilityBody}{' '}
                  {designedFor}
                  {t.tools.compatibilitySuffix}
                </p>
                <p className="mt-2">
                  {tested
                    ? `${t.tools.testedVersions}: ${tested}.`
                    : t.tools.untested}
                </p>
              </Callout>

              <section className="mt-10">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">{t.tools.verifiedFacts}</h2>
                <ul className="mt-4 space-y-2 text-sm">
                  {t.tools.verifiedFactsList.map((fact) => (
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
                              {active === 'en'
                                ? (module.purposeEn ?? module.purpose)
                                : module.purpose}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs text-muted">
                  {t.tools.moduleNote}
                </p>
              </section>

              <section className="mt-12">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
                  {t.tools.licensing}
                </h2>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Card className="p-5">
                    <h3 className="font-bold text-navy">{t.tools.machineActivation}</h3>
                    <p className="mt-2 text-sm text-muted">
                      {t.tools.machineActivationBody}
                    </p>
                    <p className="font-latin mt-3 rounded-md bg-surface px-3 py-2 text-xs text-navy">
                      NBM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
                    </p>
                  </Card>

                  <Card className="p-5">
                    <h3 className="font-bold text-navy">{t.tools.tokenCredit}</h3>
                    <p className="mt-2 text-sm text-muted">
                      {t.tools.tokenCreditBody}
                    </p>
                  </Card>
                </div>

                <h3 className="mt-8 font-bold text-navy">{t.tools.tokenSpendHeading}</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  <li>{t.tools.tokenSpend1}</li>
                  <li>{t.tools.tokenSpend2}</li>
                  <li>
                    {t.tools.tokenSpend3Prefix} <strong>{t.tools.tokenSpend3Strong}</strong>{' '}
                    {t.tools.tokenSpend3Suffix}
                  </li>
                  <li>{t.tools.tokenSpend4}</li>
                </ul>

                <Callout tone="warning" className="mt-6">
                  <p>
                    <strong>{t.tools.reinstallLabel}</strong> {t.tools.reinstallBody}
                  </p>
                  <p className="mt-2">
                    {t.tools.screenshotBody}{' '}
                    <Link href="/support/license-recovery" className="text-blue underline">
                      {t.tools.recoveryLink}
                    </Link>
                    {t.tools.screenshotSuffix}
                  </p>
                </Callout>
              </section>

              <section className="mt-12">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">{t.tools.installation}</h2>
                <p className="font-latin mt-3 rounded-[--radius-card] border border-line bg-surface px-4 py-3 text-sm text-navy">
                  Welcome → System Check → License Agreement → Install → Finish
                </p>
                <p className="mt-3 text-sm text-muted">
                  {t.tools.installationBody}
                </p>
                <ol className="mt-4 space-y-2 text-sm">
                  {t.tools.installSteps.map((step, index) => (
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
                <div className="mt-12">
                  {tools.copy_translated ? null : (
                    <Callout tone="info" title={t.cms.untranslatedTitle} role="status">
                      {t.cms.untranslatedBody}
                    </Callout>
                  )}
                  <Prose html={tools.description_html} data-authored="true" />
                </div>
              ) : null}

              <section className="mt-12">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
                  {t.tools.faq}
                </h2>
                <dl className="mt-5 divide-y divide-line rounded-[--radius-card] border border-line">
                  {faq.map((item) => (
                    <div key={item.question} className="px-5 py-4">
                      <dt className="font-bold text-navy">{item.question}</dt>
                      <dd className="mt-1.5 text-sm text-muted">{item.answer}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <Callout tone="info" className="mt-10">
                <p>
                  <strong>{t.tools.responsibilityLabel}</strong> {t.tools.responsibilityBody}
                </p>
              </Callout>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Card className="p-6">
                {tools ? (
                  <AddToCart variants={tools.variants ?? []} />
                ) : (
                  <Callout tone="info">
                    {t.tools.loadFailed}
                  </Callout>
                )}

                <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t.tools.version}</dt>
                    <dd className="font-latin font-medium text-navy">
                      {release?.data?.version ?? 'v6.0'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t.tools.platform}</dt>
                    <dd className="font-latin font-medium text-navy">Windows 10 / 11, 64-bit</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t.tools.modules}</dt>
                    <dd className="font-latin font-medium text-navy">{MODULE_COUNT}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">SHA-256</dt>
                    <dd className="font-latin mt-1 break-all text-xs text-navy">
                      {release?.data?.checksum_sha256 ?? t.tools.checksumPending}
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
