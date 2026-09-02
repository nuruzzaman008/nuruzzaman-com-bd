import type { Metadata } from 'next';
import Link from 'next/link';
import type { Product } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { PriceTag } from '@/components/ui/price';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('প্রোডাক্ট');

export default async function DashboardProductsPage() {
  const products = await sessionApi<{ data: Product[] }>('/admin/products');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">প্রোডাক্ট</h1>
      <p className="mt-2 text-muted">
        দাম প্রকাশ না করা পর্যন্ত ভ্যারিয়েন্টটি বিক্রয়যোগ্য নয় এবং সাইটে
        &ldquo;দাম জানতে যোগাযোগ করুন&rdquo; দেখায়।
      </p>

      <div className="mt-6">
        <DataTable
          caption="প্রোডাক্টের তালিকা"
          rows={products.data}
          getRowKey={(product) => product.slug}
          empty={<EmptyState title="কোনো প্রোডাক্ট নেই" />}
          columns={[
            {
              key: 'name',
              header: 'প্রোডাক্ট',
              render: (product) => (
                <span>
                  <Link
                    href={`/shop/${product.slug}`}
                    className="block font-medium text-blue hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="font-latin block text-xs text-muted">/{product.slug}</span>
                </span>
              ),
            },
            {
              key: 'type',
              header: 'ধরন',
              render: (product) => <Badge tone="info">{product.type}</Badge>,
            },
            {
              key: 'variants',
              header: 'ভ্যারিয়েন্ট',
              render: (product) => (
                <ul className="space-y-1">
                  {(product.variants ?? []).map((variant) => (
                    <li key={variant.id} className="text-xs">
                      <span className="font-latin text-navy">{variant.sku}</span>{' '}
                      <PriceTag
                        value={variant.price ?? null}
                        size="sm"
                        unavailableLabel="দাম প্রকাশ করা হয়নি"
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
