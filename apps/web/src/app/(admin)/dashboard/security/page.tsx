import type { Metadata } from 'next';
import type { User } from '@nuruzzaman/contracts';

import { TwoFactorSetup } from '@/features/dashboard/two-factor-setup';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.security.title);
}

/**
 * Where staff set up the authenticator app the dashboard requires. Reachable
 * even while the rest of the dashboard is closed to them, because it reads
 * their own account rather than anything under /admin.
 */
export default async function DashboardSecurityPage() {
  const { t } = await adminDictionary();
  const me = await sessionApi<{ data: User }>('/me');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.security.title}</h1>

      <div className="mt-6 max-w-2xl">
        <TwoFactorSetup enabled={me.data.mfa_enabled} />
      </div>
    </div>
  );
}
