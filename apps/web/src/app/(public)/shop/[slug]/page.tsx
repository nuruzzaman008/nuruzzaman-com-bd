import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, type Product } from '@nuruzzaman/contracts';

import { AddToCart } from '@/features/catalog/add-to-cart';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Prose } from '@/components/ui/prose';
import { publicApi } from '@/lib/api/server';
import { buildMetadata, jsonLd, productSchema } from '@/lib/seo';

async function loadProduct(slug: string): Promise<Product> {
  try {
    const response = await publicApi<{ data: Product }>(`/products/${encodeURIComponent(slug)}`, {
      tags: ['products', `product:${slug}`],
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

export default async function ProductPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const product = await loadProduct(slug);

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
            { name: 'হোম', path: '/' },
            { name: 'শপ', path: '/shop' },
            { name: product.name, path: `/shop/${product.slug}` },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <h1 className="text-[length:var(--step-h1)] leading-tight font-bold text-navy">
              {product.name}
            </h1>
            {product.tagline ? <p className="mt-3 text-lg text-muted">{product.tagline}</p> : null}

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
              <Prose html={product.description_html} className="mt-8" />
            ) : null}

            {product.feature_groups?.length ? (
              <section className="mt-10">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
                  ফিচার গ্রুপ
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
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">স্পেসিফিকেশন</h2>
                <dl className="mt-4 divide-y divide-line rounded-[--radius-card] border border-line bg-white">
                  {Object.entries(product.specs).map(([key, value]) => (
                    <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
                      <dt className="font-latin text-sm font-semibold text-navy capitalize">
                        {key.replace(/_/g, ' ')}
                      </dt>
                      <dd className="text-sm text-muted">{value}</dd>
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
                <li>ডিজিটাল ডেলিভারি — অ্যাকাউন্ট থেকে ডাউনলোড</li>
                <li>SHA-256 চেকসাম প্রকাশ করা হয়</li>
                <li>পেমেন্ট SSLCOMMERZ-এর hosted page-এ</li>
              </ul>

              <p className="mt-4 text-xs text-muted">
                কেনার আগে{' '}
                <Link href="/refund-policy" className="underline">
                  রিফান্ড নীতি
                </Link>{' '}
                এবং{' '}
                <Link href="/software-eula" className="underline">
                  EULA
                </Link>{' '}
                পড়ে নিন।
              </p>
            </Card>

            <Callout tone="warning" className="mt-4">
              সফটওয়্যারটি একটি productivity aid। চূড়ান্ত যাচাই ও পেশাগত দায়িত্ব যোগ্য
              ব্যবহারকারীর।
            </Callout>
          </aside>
        </div>
      </Container>
    </>
  );
}
