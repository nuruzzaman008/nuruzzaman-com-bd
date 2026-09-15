import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError } from '@nuruzzaman/contracts';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { AttachmentDetailsPage } from '@/features/dashboard/attachment-details';
import { mediaTitle, type MediaDetail } from '@/features/dashboard/media-filters';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.media);
}

/** "Edit more details": one file's attachment details on a page of its own. */
export default async function DashboardMediaItemPage(props: { params: Promise<{ id: string }> }) {
  const { locale, t } = await adminDictionary();
  const { id } = await props.params;

  if (!/^\d+$/.test(id)) {
    notFound();
  }

  let item: MediaDetail;

  try {
    const response = await sessionApi<{ data: MediaDetail }>(`/admin/media/${id}`);
    item = response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.isForbidden)) {
      notFound();
    }

    throw error;
  }

  const title = mediaTitle(item);

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: t.admin.nav.dashboard, path: '/dashboard' },
          { name: t.admin.nav.media, path: '/dashboard/media' },
          { name: title, path: `/dashboard/media/${id}` },
        ]}
      />
      <h1 className="mt-4 text-[length:var(--step-h1)] font-bold text-navy">
        {locale === 'bn' ? 'ফাইল সম্পাদনা' : 'Edit Media'}
      </h1>
      <p className="font-latin mt-1 text-muted">{title}</p>

      <AttachmentDetailsPage item={item} />
    </div>
  );
}
