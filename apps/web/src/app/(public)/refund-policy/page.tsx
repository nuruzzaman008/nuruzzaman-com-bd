import type { Metadata } from 'next';

import { CmsPage, cmsPageMetadata } from '@/features/content/cms-page';

const SLUG = 'refund-policy';
const PATH = '/refund-policy';

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
        { name: 'রিফান্ড নীতি', path: '/refund-policy' },
      ]}
    />
  );
}
