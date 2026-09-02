import type { Metadata } from 'next';

import { CmsPage, cmsPageMetadata } from '@/features/content/cms-page';

const SLUG = 'support-system-requirements';
const PATH = '/support/system-requirements';

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
        { name: 'সিস্টেম রিকোয়ারমেন্ট', path: '/support/system-requirements' },
      ]}
    />
  );
}
