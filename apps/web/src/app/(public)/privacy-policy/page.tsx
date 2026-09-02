import type { Metadata } from 'next';

import { CmsPage, cmsPageMetadata } from '@/features/content/cms-page';

const SLUG = 'privacy-policy';
const PATH = '/privacy-policy';

export function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata(SLUG, PATH);
}

export default function Page() {
  return (
    <CmsPage
      slug={SLUG}
      showToc={false}
      trail={[
        { name: 'হোম', path: '/' },
        { name: 'গোপনীয়তা নীতি', path: '/privacy-policy' },
      ]}
    />
  );
}
