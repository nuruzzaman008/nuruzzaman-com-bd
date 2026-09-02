import type { Metadata } from 'next';

import { CmsPage, cmsPageMetadata } from '@/features/content/cms-page';

const SLUG = 'support-activation';
const PATH = '/support/activation';

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
        { name: 'অ্যাক্টিভেশন', path: '/support/activation' },
      ]}
    />
  );
}
