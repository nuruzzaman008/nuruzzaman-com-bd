import type { Metadata } from 'next';

import { Callout } from '@/components/ui/callout';
import type { PricedVariant } from '@/features/dashboard/product-prices';
import {
  ReleasesManager,
  type AdminRelease,
  type LicenceOption,
} from '@/features/dashboard/releases-manager';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.releases);
}

type ProductRow = { id?: number; type: string; name: string };

export default async function DashboardReleasesPage() {
  const { locale, t } = await adminDictionary();
  const bn = locale === 'bn';

  const [releases, products] = await Promise.all([
    sessionApi<{ data: AdminRelease[] }>('/admin/download-assets'),
    sessionApi<{ data: ProductRow[] }>('/admin/products', { query: { exclude_type: 'course' } }),
  ]);

  // The licences a release can be given with: every variant of every software
  // licence product, the office packs included.
  const licenceProducts = products.data.filter(
    (product): product is ProductRow & { id: number } =>
      product.type === 'software_license' && typeof product.id === 'number',
  );
  const details = await Promise.all(
    licenceProducts.map((product) =>
      sessionApi<{ data: { name: string; all_variants?: PricedVariant[] } }>(
        `/admin/products/${product.id}`,
      ),
    ),
  );
  const licences: LicenceOption[] = details.flatMap((detail) =>
    (detail.data.all_variants ?? []).map((variant) => ({
      id: variant.id,
      label: variant.name,
    })),
  );

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.releases}</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {bn
          ? 'যে software installer ক্রেতা payment-এর পর download করবেন, তা এখান থেকে upload করুন। প্রতিটি AutoCAD version-এর জন্য একটি release তৈরি করে ফাইল upload করুন, licence বেছে দিন, তারপর "Download চালু করুন"। ক্রেতা Account → Downloads থেকে নামাবেন।'
          : 'Upload the software installers buyers download after paying here. Create a release for each AutoCAD version, upload its file, choose the licences, then switch its download on. Buyers download from Account → Downloads.'}
      </p>

      <Callout tone="warning" className="mt-4 max-w-3xl">
        {t.admin.releases.storageNote}
      </Callout>

      <div className="mt-6">
        <ReleasesManager releases={releases.data} licences={licences} />
      </div>
    </div>
  );
}
