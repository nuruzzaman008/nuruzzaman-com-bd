import type { Metadata } from 'next';
import Link from 'next/link';
import type { Product } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { PriceTag } from '@/components/ui/price';
import { EmptyState } from '@/components/ui/states';
import { AdminSearchForm } from '@/features/admin/admin-search-form';
import { SeoScore, ViewLink } from '@/features/admin/seo-score';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.products);
}

export default async function DashboardProductsPage(props: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const bn = locale === 'bn';
  const q = (await props.searchParams).q?.trim() || undefined;
  const products = await sessionApi<{ data: Product[]; meta?: { total?: number } }>(
    '/admin/products',
    // Course listings exist only so a course can be bought; they are managed under Courses.
    { query: { q, exclude_type: 'course' } },
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
          {t.admin.nav.products}
        </h1>
        <Link
          href="/dashboard/products/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-blue px-5 font-semibold text-white hover:bg-navy"
        >
          {t.admin.products.newProduct}
        </Link>
      </div>
      <p className="mt-2 text-muted">{t.admin.products.priceRule}</p>
      <p className="mt-1 text-sm text-muted">
        {bn
          ? 'কোর্স বিক্রির listing এখানে দেখানো হয় না — সেগুলো '
          : 'Course listings are not shown here — manage them under '}
        <Link href="/dashboard/courses" className="font-semibold text-blue hover:underline">
          {bn ? 'কোর্স' : 'Courses'}
        </Link>
        {bn ? ' থেকে চালান।' : '.'}
      </p>

      <AdminSearchForm
        id="product-search"
        basePath="/dashboard/products"
        value={q}
        total={products.meta?.total ?? products.data.length}
        label={bn ? 'প্রোডাক্ট খুঁজুন' : 'Search products'}
        placeholder={bn ? 'প্রোডাক্টের নাম বা URL slug…' : 'Product name or URL slug…'}
        searchLabel={t.admin.common.search}
        locale={locale}
      />

      <div className="mt-6">
        <DataTable
          caption={t.admin.products.caption}
          rows={products.data}
          getRowKey={(product) => product.slug}
          empty={
            <EmptyState
              title={
                q
                  ? bn
                    ? `“${q}” নামে বা slug-এ কোনো প্রোডাক্ট পাওয়া যায়নি`
                    : `No product matches “${q}”`
                  : t.admin.products.empty
              }
            />
          }
          columns={[
            {
              key: 'name',
              header: t.admin.products.product,
              render: (product) => (
                <span>
                  <Link
                    href={
                      product.id ? `/dashboard/products/${product.id}` : `/products/${product.slug}`
                    }
                    data-authored="true"
                    className="block font-medium text-blue hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="font-latin block text-xs text-muted">/{product.slug}</span>
                </span>
              ),
            },
            {
              key: 'seo',
              header: 'SEO',
              render: (product) =>
                product.id ? (
                  <SeoScore
                    t={t}
                    locale={locale}
                    href={`/dashboard/products/${product.id}/seo`}
                    input={{
                      kind: 'product',
                      title: product.name,
                      slug: product.slug,
                      content: product.description_html,
                      excerpt: product.tagline ?? undefined,
                      metaTitle: product.seo?.meta_title ?? '',
                      metaDescription: product.seo?.meta_description ?? '',
                      focusKeyword: product.seo?.focus_keyword ?? '',
                      featuredImage: product.cover_url ? { alt: product.cover_alt ?? null } : null,
                    }}
                  />
                ) : null,
            },
            {
              key: 'view',
              header: t.admin.common.view,
              align: 'end',
              render: (product) => (
                <ViewLink
                  href={product.published_at ? `/products/${product.slug}` : null}
                  label={t.admin.common.view}
                  draftLabel={t.admin.courses.draft}
                />
              ),
            },
            {
              key: 'type',
              header: t.admin.common.type,
              render: (product) => <Badge tone="info">{product.type}</Badge>,
            },
            {
              key: 'variants',
              header: t.admin.products.variants,
              render: (product) => (
                <ul className="space-y-1">
                  {(product.variants ?? []).map((variant) => (
                    <li key={variant.id} className="text-xs">
                      <span className="font-latin text-navy">{variant.sku}</span>{' '}
                      <PriceTag
                        value={variant.price ?? null}
                        size="sm"
                        unavailableLabel={t.admin.products.noPrice}
                      />
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
