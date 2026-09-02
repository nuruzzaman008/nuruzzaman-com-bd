import type { Metadata } from 'next';
import type { ProductSummary } from '@nuruzzaman/contracts';

import { ProductCard } from '@/features/catalog/product-card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Container } from '@/components/ui/container';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/states';
import { publicApi } from '@/lib/api/server';
import { buildMetadata, itemListSchema, jsonLd } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'শপ — সফটওয়্যার, ক্রেডিট ও কোর্স',
  description:
    'NB Engineering Tools লাইসেন্স, NB Credit রিফিল এবং কোর্স — সবকিছু এক জায়গায়।',
  path: '/shop',
});

export default async function ShopPage(props: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const searchParams = await props.searchParams;

  const products = await publicApi<{
    data: ProductSummary[];
    meta?: { current_page?: number; last_page?: number };
  }>('/products', {
    query: { page: searchParams.page, type: searchParams.type, per_page: 24 },
    tags: ['products'],
  });

  return (
    <>
      {products.data.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              itemListSchema(
                products.data.map((product) => ({
                  name: product.name,
                  path: `/shop/${product.slug}`,
                })),
              ),
            ),
          }}
        />
      ) : null}

      <Container className="py-10 sm:py-14">
        <Breadcrumbs
          trail={[
            { name: 'হোম', path: '/' },
            { name: 'শপ', path: '/shop' },
          ]}
        />

        <header className="mt-6 max-w-3xl">
          <h1 className="text-[length:var(--step-h1)] font-bold text-navy">শপ</h1>
          <p className="mt-3 text-muted">
            সব পণ্য ডিজিটাল। ক্রয়ের পরে ডাউনলোড ও কোর্স অ্যাক্সেস আপনার অ্যাকাউন্টের সঙ্গে
            যুক্ত থাকে।
          </p>
        </header>

        <Callout tone="info" className="mt-6 max-w-3xl">
          যে পণ্যের দাম এখনো প্রকাশ করা হয়নি, সেখানে &ldquo;দাম জানতে যোগাযোগ করুন&rdquo;
          দেখানো হয় — কোনো অনুমানভিত্তিক দাম দেখানো হয় না।
        </Callout>

        {products.data.length > 0 ? (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.data.map((product) => (
              <li key={product.slug} className="contents">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="mt-8"
            title="এখনো কোনো পণ্য প্রকাশ করা হয়নি"
            description="পণ্য প্রকাশিত হলে এখানে দেখা যাবে।"
          />
        )}

        <Pagination
          meta={products.meta}
          basePath="/shop"
          searchParams={searchParams as Record<string, string | undefined>}
        />
      </Container>
    </>
  );
}
