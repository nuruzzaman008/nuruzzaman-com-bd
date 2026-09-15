import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError } from '@nuruzzaman/contracts';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { AffiliateAdminDetail } from '@/features/affiliate/affiliate-admin-detail';
import type { AdminAffiliateDetail } from '@/features/affiliate/affiliate-shared';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.affiliates);
}

export default async function DashboardAffiliatePage(props: { params: Promise<{ id: string }> }) {
  const { t } = await adminDictionary();
  const { id } = await props.params;

  let affiliate: AdminAffiliateDetail;

  try {
    const response = await sessionApi<{ data: AdminAffiliateDetail }>(
      `/admin/affiliates/${encodeURIComponent(id)}`,
    );
    affiliate = response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.isForbidden)) {
      notFound();
    }

    throw error;
  }

  const name = affiliate.user?.name ?? affiliate.code;

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: t.admin.nav.dashboard, path: '/dashboard' },
          { name: t.admin.nav.affiliates, path: '/dashboard/affiliates' },
          { name, path: `/dashboard/affiliates/${id}` },
        ]}
      />
      <h1 className="mt-4 text-[length:var(--step-h1)] font-bold text-navy">{name}</h1>
      <AffiliateAdminDetail affiliate={affiliate} />
    </div>
  );
}
