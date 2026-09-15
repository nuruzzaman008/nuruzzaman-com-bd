import type { Metadata } from 'next';

import type { AffiliateAccount } from '@/features/affiliate/affiliate-shared';
import { AffiliateDashboard } from '@/features/affiliate/affiliate-dashboard';
import { sessionApi } from '@/lib/api/server';
import { publicEnv } from '@/lib/env';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.account.nav.affiliate);
}

export default async function AccountAffiliatePage() {
  const { t } = await adminDictionary();
  const response = await sessionApi<{ data: AffiliateAccount }>('/account/affiliate');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.account.nav.affiliate}
      </h1>
      <AffiliateDashboard account={response.data} siteUrl={publicEnv.siteUrl} />
    </div>
  );
}
