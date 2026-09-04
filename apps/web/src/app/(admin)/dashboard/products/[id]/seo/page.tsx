import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type Product } from '@nuruzzaman/contracts';

import { SeoEditor } from '@/features/dashboard/seo-editor';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.productSeo);
}

export default async function ProductSeoPage(props: { params: Promise<{ id: string }> }) {
  const { t } = await adminDictionary();
  const { id } = await props.params;

  let product: Product;

  try {
    const response = await sessionApi<{ data: Product }>(
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
          { name: product.name, path: `/dashboard/products/${id}/seo` },
        ]}
      />

      <h1 className="mt-4 text-[length:var(--step-h1)] font-bold text-navy">
        SEO — {product.name}
      </h1>

      <div className="mt-6">
        <SeoEditor
          kind="product"
          endpoint={`/admin/products/${id}`}
          title={product.name}
          slug={product.slug}
          // The analysis reads the product description, which the API returns as
          // HTML; the analyser strips tags, so this measures the prose itself.
          body={product.description_html ?? ''}
          excerpt={product.tagline ?? ''}
          seo={product.seo ?? null}
        />
      </div>
    </div>
  );
}
