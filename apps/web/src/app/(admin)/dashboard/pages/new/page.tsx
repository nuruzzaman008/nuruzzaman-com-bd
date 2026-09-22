import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { NewContentForm } from '@/features/dashboard/new-content-form';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.newContent.heading.page);
}

export default async function NewPagePage() {
  const { t } = await adminDictionary();

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: t.admin.nav.dashboard, path: '/dashboard' },
          { name: t.admin.nav.pages, path: '/dashboard/pages' },
          { name: t.admin.newContent.heading.page, path: '/dashboard/pages/new' },
        ]}
      />

      <h1 className="mt-4 text-[length:var(--step-h1)] font-bold text-navy">
        {t.admin.newContent.heading.page}
      </h1>
      <p className="mt-2 max-w-xl text-muted">{t.admin.newContent.intro.page}</p>

      <div className="mt-6">
        <NewContentForm kind="page" />
      </div>
    </div>
  );
}
