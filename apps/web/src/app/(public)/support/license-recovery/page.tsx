import type { Metadata } from 'next';

import { CmsPage, cmsPageMetadata } from '@/features/content/cms-page';

const SLUG = 'support-license-recovery';
const PATH = '/support/license-recovery';

export function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata(SLUG, PATH);
}

export default function Page() {
  return (
    <CmsPage
      slug={SLUG}
      showToc={true}
      trail={[
        { name: 'হোম', path: '/' },
        { name: 'সাপোর্ট', path: '/support' },
        { name: 'লাইসেন্স রিকভারি', path: '/support/license-recovery' },
      ]}
    />
  );
}
