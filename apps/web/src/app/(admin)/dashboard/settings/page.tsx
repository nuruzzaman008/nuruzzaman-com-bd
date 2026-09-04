import type { Metadata } from 'next';
import type { Setting } from '@nuruzzaman/contracts';

import { SettingsForm } from '@/features/dashboard/settings-form';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.settings.title);
}

export default async function DashboardSettingsPage() {
  const { t } = await adminDictionary();
  const settings = await sessionApi<{ data: Setting[] }>('/admin/settings');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.admin.settings.title}
      </h1>

      <Callout tone="info" className="mt-4 max-w-3xl">
        {t.admin.settings.envNote}{' '}
        <span className="font-latin">docs/CONFIGURATION_CHECKLIST_BN.md</span>
      </Callout>

      <div className="mt-6 max-w-3xl">
        {settings.data.length === 0 ? (
          <EmptyState
            title={t.admin.settings.empty}
            description={t.admin.settings.emptyHint}
          />
        ) : (
          <SettingsForm settings={settings.data} />
        )}
      </div>
    </div>
  );
}
