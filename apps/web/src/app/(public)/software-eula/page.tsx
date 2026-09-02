import type { Metadata } from 'next';

import { CmsPage, cmsPageMetadata } from '@/features/content/cms-page';

const SLUG = 'software-eula';
const PATH = '/software-eula';

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
        { name: 'সফটওয়্যার EULA', path: '/software-eula' },
      ]}
    />
  );
}
