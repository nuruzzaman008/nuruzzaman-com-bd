import type { Metadata } from 'next';
import type { DownloadAsset } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date, fileSize } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('রিলিজ ও ডাউনলোড');

export default async function DashboardReleasesPage() {
  const releases = await sessionApi<{ data: DownloadAsset[] }>('/admin/download-assets');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">রিলিজ ও ডাউনলোড</h1>

      <Callout tone="warning" className="mt-4 max-w-3xl">
        ইনস্টলার সবসময় প্রাইভেট ডিস্কে থাকে, কখনো Next.js-এর{' '}
        <span className="font-latin">/public</span> ফোল্ডারে বা পাবলিক বাকেটে নয়। চেকসাম
        আপলোড করা বাইট থেকে সার্ভারেই হিসাব করা হয়। ফাইল আপলোড না করা পর্যন্ত রিলিজ
        উপলব্ধ করা যায় না।
      </Callout>

      <div className="mt-6">
        <DataTable
          caption="রিলিজের তালিকা"
          rows={releases.data}
          getRowKey={(release) => release.slug}
          empty={<EmptyState title="কোনো রিলিজ নেই" />}
          columns={[
            {
              key: 'name',
              header: 'রিলিজ',
              render: (release) => (
                <span>
                  <span className="block font-medium text-navy">{release.name}</span>
                  <span className="font-latin block text-xs text-muted">
                    {release.version ? `v${release.version}` : 'ভার্সন নেই'} · /{release.slug}
                  </span>
                </span>
              ),
            },
            {
              key: 'file',
              header: 'ফাইল',
              render: (release) => (
                <span className="font-latin text-xs">
                  {fileSize(release.size_bytes) ?? 'আপলোড হয়নি'}
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
                    : 'হিসাব করা হয়নি'}
                </span>
              ),
            },
            {
              key: 'signing',
              header: 'সাইনিং',
              render: (release) => (
                <Badge tone={release.code_signing_status.startsWith('signed') ? 'success' : 'warning'}>
                  {release.code_signing_status}
                </Badge>
              ),
            },
            {
              key: 'available',
              header: 'অবস্থা',
              render: (release) =>
                release.is_available ? (
                  <Badge tone="success">উপলব্ধ</Badge>
                ) : (
                  <Badge tone="neutral">প্রকাশিত নয়</Badge>
                ),
            },
            {
              key: 'released',
              header: 'প্রকাশ',
              render: (release) => date(release.released_at) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
