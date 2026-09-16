import type { SiteSettings } from '@nuruzzaman/contracts';

import { SiteCode } from '@/components/layout/site-code';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { tryPublicApi } from '@/lib/api/server';

export default async function CommerceLayout({ children }: { children: React.ReactNode }) {
  const settings = await tryPublicApi<{ data: SiteSettings }>('/site/settings', {
    tags: ['settings'],
    revalidate: 600,
  });

  return (
    <>
      {/* The owner's own tags: verification, analytics, ads. */}
      <SiteCode slot="top" />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings?.data ?? null} />
      <SiteCode slot="bottom" />
    </>
  );
}
