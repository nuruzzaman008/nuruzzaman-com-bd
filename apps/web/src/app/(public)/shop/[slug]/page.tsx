import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ApiError, type Product } from '@nuruzzaman/contracts';

import { AddToCart } from '@/features/catalog/add-to-cart';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { LocaleLink } from '@/components/ui/locale-link';
import { Prose } from '@/components/ui/prose';
import { publicApi } from '@/lib/api/server';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';
import { buildMetadata, jsonLd, productSchema } from '@/lib/seo';

async function loadProduct(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<Product> {
  try {
    const response = await publicApi<{ data: Product }>(`/products/${encodeURIComponent(slug)}`, {
      query: { locale },
      tags: ['products', `product:${slug}`, `product-locale:${locale}`],
    });

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await loadProduct(slug);

  return buildMetadata({
    title: product.name,
    description: product.tagline,
    path: `/shop/${product.slug}`,
    image: product.cover_url,
    seo: product.seo,
  });
}

export default async function ProductPage(
  props: LocalizedPageProps & { params: Promise<{ slug: string }> },
) {
  const { locale, t } = pageDictionary(props.locale);
  const { slug } = await props.params;
  const product = await loadProduct(slug, locale);

  const cheapest = (product.variants ?? [])
    .map((variant) => variant.price)
    .filter((price): price is NonNullable<typeof price> => Boolean(price))
    .sort((a, b) => a.amount_minor - b.amount_minor)[0];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            productSchema({
              name: product.name,
              slug: product.slug,
              tagline: product.tagline,
              cover_url: product.cover_url,
              // No published price means no Offer at all, rather than an
              // invented one the page does not display.
              price: cheapest ?? null,
            }),
          ),
        }}
      />

      <Container className="py-10 sm:py-14">
        <Breadcrumbs
          trail={[
            { name: t.common.home, path: '/' },
            { name: t.shop.heading, path: '/shop' },
            { name: product.name, path: `/shop/${product.slug}`, authored: true },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <h1
              data-authored="true"
              className="text-[length:var(--step-h1)] leading-tight font-bold text-navy"
            >
              {product.name}
            </h1>
            {product.tagline ? (
              <p data-authored="true" className="mt-3 text-lg text-muted">
                {product.tagline}
              </p>
            ) : null}

            {product.cover_url ? (
              <Image
                src={product.cover_url}
                alt={product.cover_alt ?? ''}
                width={1200}
                height={630}
                sizes="(min-width: 1024px) 700px, 100vw"
                priority
                className="mt-8 aspect-[1200/630] w-full rounded-[--radius-card] border border-line object-cover"
              />
            ) : null}

            {product.description_html ? (
              <div className="mt-8">
                {product.copy_translated ? null : (
                  <Callout tone="info" title={t.cms.untranslatedTitle} role="status">
                    {t.cms.untranslatedBody}
                  </Callout>
                )}
                <Prose html={product.description_html} data-authored="true" />
              </div>
            ) : null}

            {product.feature_groups?.length ? (
              <section className="mt-10">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
                  {t.product.featureGroups}
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {product.feature_groups.map((group) => (
                    <li
                      key={group}
                      className="font-latin rounded-[--radius-card] border border-line bg-white px-4 py-3 text-sm font-semibold text-navy"
                    >
                      {group}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {product.specs && Object.keys(product.specs).length > 0 ? (
              <section className="mt-10">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
                  {t.product.specifications}
                </h2>
                <dl className="mt-4 divide-y divide-line rounded-[--radius-card] border border-line bg-white">
                  {Object.entries(product.specs).map(([key, value]) => (
                    <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
                      <dt className="font-latin text-sm font-semibold text-navy capitalize">
                        {key.replace(/_/g, ' ')}
                      </dt>
                      <dd data-authored="true" className="text-sm text-muted">
                      {value}
                    </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="p-6">
              <AddToCart variants={product.variants ?? []} />

              <ul className="mt-6 space-y-2 border-t border-line pt-5 text-sm text-muted">
                <li>{t.product.digitalDelivery}</li>
                <li>{t.product.checksumPublished}</li>
                <li>{t.product.paymentHosted}</li>
              </ul>

              <p className="mt-4 text-xs text-muted">
                {t.product.beforeBuying}{' '}
                <LocaleLink href="/refund-policy" className="underline">
                  {t.pageTitle.refund}
                </LocaleLink>{' '}
                {t.product.and}{' '}
                <LocaleLink href="/software-eula" className="underline">
                  EULA
                </LocaleLink>
                {t.product.readThem}
              </p>
            </Card>

            <Callout tone="warning" className="mt-4">
              {t.product.productivityAid}
            </Callout>
          </aside>
        </div>
      </Container>
    </>
  );
}
