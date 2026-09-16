import type { Metadata } from 'next';
import Link from 'next/link';
import type { Product } from '@nuruzzaman/contracts';

import { AdminSearchForm } from '@/features/admin/admin-search-form';
import { ListFilters, StatusLinks } from '@/features/admin/list-filters';
import { seoScoreOf } from '@/features/admin/seo-score';
import { ProductList, type ProductRow } from '@/features/dashboard/product-list';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.products);
}

export default async function DashboardProductsPage(props: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; month?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const bn = locale === 'bn';
  const searchParams = await props.searchParams;
  const q = searchParams.q?.trim() || undefined;
  const current = {
    q,
    status: searchParams.status,
    type: searchParams.type,
    month: searchParams.month,
  };
  const products = await sessionApi<{
    data: Product[];
    meta?: { total?: number };
    filters?: { counts?: Record<string, number>; months?: string[]; types?: string[] };
  }>(
    '/admin/products',
    // Course listings exist only so a course can be bought; they are managed under Courses.
    { query: { ...current, exclude_type: 'course' } },
  );

  const rows: ProductRow[] = products.data.map((product) => ({
    id: product.id ?? null,
    slug: product.slug,
    title: product.name,
    type: product.type,
    live: Boolean(product.published_at),
    variants: (product.variants ?? []).map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      price: variant.price ?? null,
    })),
    seoScore: seoScoreOf(
      {
        kind: 'product',
        title: product.name,
        slug: product.slug,
        content: product.description_html,
        excerpt: product.tagline ?? undefined,
        metaTitle: product.seo?.meta_title ?? '',
        metaDescription: product.seo?.meta_description ?? '',
        focusKeyword: product.seo?.focus_keyword ?? '',
        featuredImage: product.cover_url ? { alt: product.cover_alt ?? null } : null,
      },
      t,
    ),
  }));

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

      <StatusLinks
        basePath="/dashboard/products"
        current={current}
        counts={products.filters?.counts}
      />

      <ListFilters
        basePath="/dashboard/products"
        current={current}
        months={products.filters?.months ?? []}
        selects={[
          {
            name: 'type',
            label: t.admin.filters.type,
            anyLabel: t.admin.filters.allTypes,
            options: (products.filters?.types ?? [])
              // A course listing is managed under Courses, so it is not offered here.
              .filter((type) => type !== 'course')
              .map((type) => ({
                value: type,
                label:
                  (t.admin.productTypes as Record<string, string | undefined>)[type] ?? type,
              })),
          },
        ]}
      />

      <AdminSearchForm
        id="product-search"
        basePath="/dashboard/products"
        value={q}
        keep={{ ...current, q: undefined }}
        total={products.meta?.total ?? products.data.length}
        label={bn ? 'প্রোডাক্ট খুঁজুন' : 'Search products'}
        placeholder={bn ? 'প্রোডাক্টের নাম বা URL slug…' : 'Product name or URL slug…'}
        searchLabel={t.admin.common.search}
        locale={locale}
      />

      <ProductList
        rows={rows}
        emptyTitle={
          q
            ? bn
              ? `“${q}” নামে বা slug-এ কোনো প্রোডাক্ট পাওয়া যায়নি`
              : `No product matches “${q}”`
            : t.admin.products.empty
        }
      />
    </div>
  );
}
