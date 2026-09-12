import type { Metadata } from 'next';

import { CmsPage, cmsPageMetadata } from '@/features/content/cms-page';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';

const SLUG = 'refund-policy';
const PATH = '/refund-policy';

export function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata(SLUG, PATH);
}

export default function Page({ locale }: LocalizedPageProps) {
  const { t } = pageDictionary(locale);

  return (
    <CmsPage
      slug={SLUG}
      locale={locale}
      showToc={false}
      trail={[
        { name: t.common.home, path: '/' },
        { name: t.pageTitle.refund, path: PATH },
      ]}
    />
  );
}
