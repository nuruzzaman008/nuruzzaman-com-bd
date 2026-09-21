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
 * Looking after two-step verification once it is on: recovery codes left, a
 * new set of them, turning it off to move to a new phone. Setting it up in
 * the first place happens before the dashboard, on /dashboard/two-step.
 */
export default async function DashboardSecurityPage() {
  const { t } = await adminDictionary();
  const me = await sessionApi<{ data: User }>('/me');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.security.title}</h1>

      <div className="mt-6 max-w-2xl">
        <TwoFactorSetup
          enabled={me.data.mfa_enabled}
          recoveryCodesRemaining={me.data.mfa_recovery_codes_remaining ?? null}
        />
      </div>
    </div>
  );
}
