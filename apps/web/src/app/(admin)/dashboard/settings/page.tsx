import type { Metadata } from 'next';
import type { Setting } from '@nuruzzaman/contracts';

import { SettingsForm } from '@/features/dashboard/settings-form';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('সাইট সেটিংস');

export default async function DashboardSettingsPage() {
  const settings = await sessionApi<{ data: Setting[] }>('/admin/settings');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">সাইট সেটিংস</h1>

      <Callout tone="info" className="mt-4 max-w-3xl">
        দাম, ফোন, ঠিকানা, সাপোর্ট সময়, SSLCOMMERZ ক্রেডেনশিয়াল এবং আইনি অনুমোদনের মতো
        মানগুলো এখানে নয়, সার্ভারের environment-এ রাখা হয়। তালিকা:{' '}
        <span className="font-latin">docs/CONFIGURATION_CHECKLIST_BN.md</span>
      </Callout>

      <div className="mt-6 max-w-3xl">
        {settings.data.length === 0 ? (
          <EmptyState title="কোনো সেটিং নেই" description="সিডার চালালে ডিফল্ট সেটিংস তৈরি হবে।" />
        ) : (
          <SettingsForm settings={settings.data} />
        )}
      </div>
    </div>
  );
}
