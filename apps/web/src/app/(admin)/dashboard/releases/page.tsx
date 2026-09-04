import type { Metadata } from 'next';
import type { DownloadAsset } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date, fileSize } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.releases);
}

export default async function DashboardReleasesPage() {
  const { locale, t } = await adminDictionary();
  const releases = await sessionApi<{ data: DownloadAsset[] }>('/admin/download-assets');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.admin.nav.releases}
      </h1>

      <Callout tone="warning" className="mt-4 max-w-3xl">
        {t.admin.releases.storageNote}
      </Callout>

      <div className="mt-6">
        <DataTable
          caption={t.admin.releases.caption}
          rows={releases.data}
          getRowKey={(release) => release.slug}
          empty={<EmptyState title={t.admin.releases.empty} />}
          columns={[
            {
              key: 'name',
              header: t.admin.releases.release,
              render: (release) => (
                <span>
                  <span className="block font-medium text-navy">{release.name}</span>
                  <span className="font-latin block text-xs text-muted">
                    {release.version ? `v${release.version}` : t.admin.releases.noVersion} ·{' '}
                    /{release.slug}
                  </span>
                </span>
              ),
            },
            {
              key: 'file',
              header: t.admin.releases.file,
              render: (release) => (
                <span className="font-latin text-xs">
                  {fileSize(release.size_bytes) ?? t.admin.releases.notUploaded}
                </span>
              ),
            },
            {
              key: 'checksum',
              header: 'SHA-256',
              render: (release) => (
                <span className="font-latin text-xs break-all text-muted">
                  {release.checksum_sha256
                    ? `${release.checksum_sha256.slice(0, 16)}...`
                    : t.admin.releases.notComputed}
                </span>
              ),
            },
            {
              key: 'signing',
              header: t.admin.releases.signing,
              render: (release) => (
                <Badge tone={release.code_signing_status.startsWith('signed') ? 'success' : 'warning'}>
                  {release.code_signing_status}
                </Badge>
              ),
            },
            {
              key: 'available',
              header: t.admin.common.status,
              render: (release) =>
                release.is_available ? (
                  <Badge tone="success">{t.admin.releases.available}</Badge>
                ) : (
                  <Badge tone="neutral">{t.admin.releases.notPublished}</Badge>
                ),
            },
            {
              key: 'released',
              header: t.admin.common.published,
              render: (release) => date(release.released_at, locale) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
