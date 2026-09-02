import type { Metadata } from 'next';
import Link from 'next/link';
import type { DownloadAsset, Product, SiteSettings } from '@nuruzzaman/contracts';

import { AddToCart } from '@/features/catalog/add-to-cart';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container, Section } from '@/components/ui/container';
import { Prose } from '@/components/ui/prose';
import { tryPublicApi } from '@/lib/api/server';
import { buildMetadata, jsonLd, productSchema } from '@/lib/seo';
import { supportNav } from '@/lib/site';

export const metadata: Metadata = buildMetadata({
  title: 'NB Engineering Tools — AutoCAD-এর জন্য স্ট্রাকচারাল টুলসেট',
  description:
    'AutoCAD 2024-2027-এর জন্য one-setup architecture, ২৬টি compiled VLX application, Ribbon ও classic menu, machine activation এবং signed token refill।',
  path: '/engineering-tools',
});

/** Only facts confirmed from the customer-facing product documentation. */
const VERIFIED_FACTS = [
  'NB Engineering Tools v6.0',
  'Structural & Engineering Design Tools for AutoCAD',
  'Windows 10 / 11, 64-bit',
  'AutoCAD 2024-2027-এর জন্য one-setup architecture, version-specific security runtime',
  '২৬টি compiled VLX application',
  'AutoCAD Ribbon এবং classic pull-down menu',
  'Machine activation, signed token refill, protected token wallet',
  'Vendor-verified license recovery',
  'Installer-এ upgrade, repair, uninstall, rollback ও log workflow',
  'ডেভেলপার: Engr. Md. Nuruzzaman, RSE',
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
  const cheapest = (tools?.variants ?? [])
    .map((variant) => variant.price)
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => a.amount_minor - b.amount_minor)[0];

  return (
    <>
      {tools ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              productSchema({
                name: tools.name,
                slug: tools.slug,
                tagline: tools.tagline,
                cover_url: tools.cover_url,
                price: cheapest ?? null,
              }),
            ),
          }}
        />
      ) : null}

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
                একটি সেটআপ থেকে AutoCAD 2024, 2025, 2026 ও 2027 — প্রতিটির জন্য আলাদা security
                runtime সহ। Ribbon এবং classic pull-down menu, দুইভাবেই কাজ করে।
              </p>

              <Callout tone="warning" className="mt-6">
                <p>
                  <strong>সামঞ্জস্য:</strong> Designed for AutoCAD 2024-2027.{' '}
                  {tested
                    ? `Tested compatibility: ${tested}.`
                    : 'Tested compatibility: প্রতিটি রিলিজে মালিক আলাদা করে নিশ্চিত করবেন।'}
                </p>
                <p className="mt-2">
                  রানটাইম-টেস্টের প্রমাণ ছাড়া কোনো ভার্সনকে সম্পূর্ণ পরীক্ষিত বলা হয় না।
                </p>
              </Callout>

              <section className="mt-10">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">যাচাই করা তথ্য</h2>
                <ul className="mt-4 space-y-2 text-sm">
                  {VERIFIED_FACTS.map((fact) => (
                    <li key={fact} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {tools?.feature_groups?.length ? (
                <section className="mt-10">
                  <h2 className="text-[length:var(--step-h2)] font-bold text-navy">ফিচার গ্রুপ</h2>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {tools.feature_groups.map((group) => (
                      <li
                        key={group}
                        className="font-latin rounded-[--radius-card] border border-line bg-surface px-4 py-3 text-sm font-semibold text-navy"
                      >
                        {group}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted">
                    প্রতিটি গ্রুপের ভেতরের কমান্ডের নির্ভুলতা, গতি বা কোড-সামঞ্জস্য নিয়ে এমন
                    কোনো দাবি করা হয় না যা পরীক্ষা করা হয়নি।
                  </p>
                </section>
              ) : null}

              {tools?.description_html ? (
                <Prose html={tools.description_html} className="mt-10" />
              ) : null}
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

                {release?.data ? (
                  <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">ভার্সন</dt>
                      <dd className="font-latin font-medium text-navy">
                        {release.data.version ?? 'নির্ধারিত হয়নি'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">SHA-256</dt>
                      <dd className="font-latin mt-1 break-all text-xs text-navy">
                        {release.data.checksum_sha256 ?? 'ফাইল প্রকাশের পর দেওয়া হবে'}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                <ul className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
                  {supportNav.slice(0, 4).map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="text-blue hover:underline">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}
