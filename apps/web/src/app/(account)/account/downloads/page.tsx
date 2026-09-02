import type { Metadata } from 'next';
import type { DownloadEntitlement } from '@nuruzzaman/contracts';

import { DownloadButton } from '@/features/account/download-button';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date, fileSize, number } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('আমার ডাউনলোড');

export default async function AccountDownloadsPage() {
  const entitlements = await sessionApi<{ data: DownloadEntitlement[] }>('/account/downloads');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">আমার ডাউনলোড</h1>
      <p className="mt-2 text-muted">
        ডাউনলোডের পরে SHA-256 চেকসাম মিলিয়ে নিন। চেকসাম না মিললে ফাইলটি ব্যবহার করবেন না।
      </p>

      {entitlements.data.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="কোনো ডাউনলোড এনটাইটেলমেন্ট নেই"
          description="সফটওয়্যার বা রিসোর্স কিনলে ডাউনলোড এখানে যুক্ত হবে।"
          action={<ButtonLink href="/engineering-tools">NB Engineering Tools দেখুন</ButtonLink>}
        />
      ) : (
        <ul className="mt-8 space-y-4">
          {entitlements.data.map((entitlement) => {
            const asset = entitlement.asset;

            return (
              <li key={entitlement.id}>
                <Card className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-bold text-navy">{asset?.name ?? 'ফাইল'}</h2>
                      <p className="font-latin mt-1 text-sm text-muted">
                        {asset?.version ? `v${asset.version}` : null}
                        {asset?.size_bytes ? ` · ${fileSize(asset.size_bytes)}` : null}
                        {asset?.released_at ? ` · ${date(asset.released_at)}` : null}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {entitlement.revoked_at ? (
                        <Badge tone="danger">প্রত্যাহার করা হয়েছে</Badge>
                      ) : entitlement.is_usable ? (
                        <Badge tone="success">ব্যবহারযোগ্য</Badge>
                      ) : (
                        <Badge tone="warning">ব্যবহার করা যাবে না</Badge>
                      )}
                      {asset?.is_available ? null : <Badge tone="neutral">ফাইল প্রস্তুত নয়</Badge>}
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted">ডাউনলোড ব্যবহার</dt>
                      <dd className="font-latin text-navy">
                        {number(entitlement.download_count)}
                        {entitlement.max_downloads
                          ? ` / ${number(entitlement.max_downloads)}`
                          : ' (সীমাহীন)'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">মেয়াদ</dt>
                      <dd className="text-navy">
                        {entitlement.expires_at ? date(entitlement.expires_at) : 'মেয়াদহীন'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted">SHA-256</dt>
                      <dd className="font-latin break-all text-xs text-navy">
                        {asset?.checksum_sha256 ?? 'ফাইল প্রকাশের পর দেওয়া হবে'}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5">
                    {asset?.is_available && entitlement.is_usable ? (
                      <DownloadButton slug={asset.slug} />
                    ) : (
                      <Callout tone="info">
                        {entitlement.revoked_at
                          ? 'এই এনটাইটেলমেন্ট প্রত্যাহার করা হয়েছে।'
                          : !asset?.is_available
                            ? 'ফাইলটি এখনো প্রকাশ করা হয়নি। প্রস্তুত হলে ডাউনলোড বোতাম আসবে।'
                            : 'এই এনটাইটেলমেন্ট এখন ব্যবহার করা যাবে না।'}
                      </Callout>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
