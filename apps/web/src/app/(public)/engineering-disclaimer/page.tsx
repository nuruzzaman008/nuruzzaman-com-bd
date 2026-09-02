import type { Metadata } from 'next';

import { CmsPage, cmsPageMetadata } from '@/features/content/cms-page';

const SLUG = 'engineering-disclaimer';
const PATH = '/engineering-disclaimer';

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
        { name: 'ইঞ্জিনিয়ারিং দাবিত্যাগ', path: '/engineering-disclaimer' },
      ]}
    />
  );
}
