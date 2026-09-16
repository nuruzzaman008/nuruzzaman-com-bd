'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { PriceTag, type PriceValue } from '@/components/ui/price';
import { EmptyState } from '@/components/ui/states';
import { SeoScoreBadge, ViewLink } from '@/features/admin/seo-score-badge';
import { BulkToolbar, useBulkDelete } from '@/features/dashboard/bulk-delete';
import { useLocale } from '@/lib/i18n/locale-provider';

/** The products list, with selecting and deleting. Scores are computed on the server. */
export type ProductRow = {
  id: number | null;
  slug: string;
  title: string;
  type: string;
  seoScore: number | null;
  live: boolean;
  variants: { id: number; sku: string; price: PriceValue | null }[];
};

export function ProductList({ rows, emptyTitle }: { rows: ProductRow[]; emptyTitle: string }) {
  const { locale, t } = useLocale();
  // A product the API did not give an id for cannot be addressed, let alone
  // deleted; those rows simply never carry a checkbox.
  const deletable = rows.filter((row): row is ProductRow & { id: number } => row.id !== null);
  const bulk = useBulkDelete({
    rows: deletable,
    noun: 'product',
    path: (row) => `/admin/products/${row.id}`,
  });

  return (
    <div className="mt-6">
      <BulkToolbar bulk={bulk} />

      <DataTable
        caption={t.admin.products.caption}
        rows={rows}
        getRowKey={(row) => row.slug}
        empty={<EmptyState title={emptyTitle} />}
        columns={[
          ...(bulk.active
            ? [
                {
                  key: 'select',
                  header: t.admin.bulk.selectRow,
                  render: (row: ProductRow) =>
                    row.id === null ? null : (
                      <input
                        type="checkbox"
                        className="size-4 accent-[--color-blue]"
                        checked={bulk.selected.has(row.id)}
                        disabled={bulk.busy}
                        onChange={() => bulk.toggle(row.id as number)}
                        aria-label={`${t.admin.bulk.selectRow}: ${row.title}`}
                      />
                    ),
                },
              ]
            : []),
          {
            key: 'name',
            header: t.admin.products.product,
            render: (row) => (
              <Link
                href={row.id ? `/dashboard/products/${row.id}` : `/products/${row.slug}`}
                data-authored="true"
                className="block font-medium text-blue hover:underline"
              >
                {row.title}
                <span className="font-latin block text-xs font-normal text-muted">/{row.slug}</span>
              </Link>
            ),
          },
          {
            key: 'seo',
            header: 'SEO',
            render: (row) =>
              row.id ? (
                <SeoScoreBadge
                  score={row.seoScore}
                  href={`/dashboard/products/${row.id}/seo`}
                  t={t}
                  locale={locale}
                />
              ) : null,
          },
          {
            key: 'view',
            header: t.admin.common.view,
            render: (row) => (
              <ViewLink
                href={row.live ? `/products/${row.slug}` : null}
                label={t.admin.common.view}
                draftLabel={t.admin.courses.draft}
              />
            ),
          },
          {
            key: 'type',
            header: t.admin.common.type,
            render: (row) => <Badge tone="info">{row.type}</Badge>,
          },
          {
            key: 'variants',
            header: t.admin.products.variants,
            render: (row) => (
              <ul className="space-y-1">
                {row.variants.map((variant) => (
                  <li key={variant.id} className="text-xs">
                    <span className="font-latin text-navy">{variant.sku}</span>{' '}
                    <PriceTag
                      value={variant.price}
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
  );
}
