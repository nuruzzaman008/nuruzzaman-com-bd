import type { Metadata } from 'next';
import Link from 'next/link';
import type { Product } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { PriceTag } from '@/components/ui/price';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.products);
}

export default async function DashboardProductsPage() {
  const { t } = await adminDictionary();
  const products = await sessionApi<{ data: Product[] }>('/admin/products');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.admin.nav.products}
      </h1>
      <p className="mt-2 text-muted">{t.admin.products.priceRule}</p>

      <div className="mt-6">
        <DataTable
          caption={t.admin.products.caption}
          rows={products.data}
          getRowKey={(product) => product.slug}
          empty={<EmptyState title={t.admin.products.empty} />}
          columns={[
            {
              key: 'name',
              header: t.admin.products.product,
              render: (product) => (
                <span>
                  <Link
                    href={`/shop/${product.slug}`}
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
                  <Link
                    href={`/dashboard/products/${product.id}/seo`}
                    className="text-blue hover:underline"
                  >
                    {t.admin.products.analysis}
                  </Link>
                ) : null,
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
