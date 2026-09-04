import type { Metadata } from 'next';
import Image from 'next/image';
import type { MediaItem } from '@nuruzzaman/contracts';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { fileSize } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.media);
}

export default async function DashboardMediaPage() {
  const { t } = await adminDictionary();
  const media = await sessionApi<{ data: MediaItem[] }>('/admin/media');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.media}</h1>
      <p className="mt-2 text-muted">{t.admin.media.altAdvice}</p>

      {media.data.length === 0 ? (
        <EmptyState className="mt-6" title={t.admin.media.empty} />
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.data.map((item) => (
            <li key={item.id}>
              <Card className="overflow-hidden">
                {item.url && item.mime_type.startsWith('image/') ? (
                  <Image
                    src={item.url}
                    alt={item.alt_text ?? ''}
                    width={item.width ?? 400}
                    height={item.height ?? 300}
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div aria-hidden="true" className="aspect-[4/3] w-full bg-surface" />
                )}

                <div className="p-4">
                  <p className="font-latin truncate text-sm font-medium text-navy">
                    {item.original_name}
                  </p>
                  <p className="font-latin mt-1 text-xs text-muted">
                    {item.mime_type} · {fileSize(item.size_bytes)}
                  </p>
                  <p className="mt-2 text-xs">
                    {item.alt_text ? (
                      <span className="text-muted">Alt: {item.alt_text}</span>
                    ) : (
                      <span className="font-medium text-danger">{t.admin.media.noAlt}</span>
                    )}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
