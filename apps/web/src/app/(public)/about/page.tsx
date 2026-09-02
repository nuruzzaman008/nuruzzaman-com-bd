import type { Metadata } from 'next';

import { CmsPage, cmsPageMetadata } from '@/features/content/cms-page';

const SLUG = 'about';
const PATH = '/about';

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
        { name: 'পরিচিতি', path: '/about' },
      ]}
    />
  );
}
