import type { Metadata } from 'next';

import { CmsPage, cmsPageMetadata } from '@/features/content/cms-page';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';

const SLUG = 'support-installation';
const PATH = '/support/installation';

export function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata(SLUG, PATH);
}

export default function Page({ locale }: LocalizedPageProps) {
  const { t } = pageDictionary(locale);

  return (
    <CmsPage
      slug={SLUG}
      locale={locale}
      showToc={true}
      trail={[
        { name: t.common.home, path: '/' },
        { name: t.pageTitle.support, path: '/support' },
        { name: t.pageTitle.supportInstallation, path: PATH },
      ]}
    />
  );
}
