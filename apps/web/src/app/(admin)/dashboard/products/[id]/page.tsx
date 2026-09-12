import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError } from '@nuruzzaman/contracts';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ProductEditor, type EditableProduct } from '@/features/dashboard/product-editor';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.products.editTitle);
}

export default async function ProductEditPage(props: { params: Promise<{ id: string }> }) {
  const { t } = await adminDictionary();
  const { id } = await props.params;

  let product: EditableProduct;

  try {
    const response = await sessionApi<{ data: EditableProduct }>(
      `/admin/products/${encodeURIComponent(id)}`,
    );
    product = response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.isForbidden)) {
      notFound();
    }

    throw error;
  }

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: t.admin.nav.dashboard, path: '/dashboard' },
          { name: t.admin.nav.products, path: '/dashboard/products' },
          { name: product.name, path: `/dashboard/products/${id}` },
        ]}
      />

      <h1 className="mt-4 text-[length:var(--step-h1)] font-bold text-navy" data-authored="true">
        {product.name}
      </h1>

      <div className="mt-6">
        <ProductEditor initial={product} />
      </div>
    </div>
  );
}
