import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { NewContentForm } from '@/features/dashboard/new-content-form';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.newContent.heading.product);
}

export default async function NewProductPage() {
  const { t } = await adminDictionary();

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: t.admin.nav.dashboard, path: '/dashboard' },
          { name: t.admin.nav.products, path: '/dashboard/products' },
          { name: t.admin.newContent.heading.product, path: '/dashboard/products/new' },
        ]}
      />

      <h1 className="mt-4 text-[length:var(--step-h1)] font-bold text-navy">
        {t.admin.newContent.heading.product}
      </h1>
      <p className="mt-2 max-w-xl text-muted">{t.admin.newContent.intro.product}</p>

      <div className="mt-6">
        <NewContentForm kind="product" />
      </div>
    </div>
  );
}
