import type { Metadata } from 'next';

import { CmsPage, cmsPageMetadata } from '@/features/content/cms-page';

const SLUG = 'terms';
const PATH = '/terms';

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
        { name: 'ব্যবহারের শর্তাবলি', path: '/terms' },
      ]}
    />
  );
}
