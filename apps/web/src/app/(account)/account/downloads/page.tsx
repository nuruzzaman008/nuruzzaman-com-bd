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
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.customer.downloads.title);
}

export default async function AccountDownloadsPage() {
  const { locale, t } = await adminDictionary();
  const entitlements = await sessionApi<{ data: DownloadEntitlement[] }>('/account/downloads');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.customer.downloads.title}
      </h1>
      <p className="mt-2 text-muted">{t.customer.downloads.checksumAdvice}</p>

      {entitlements.data.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={t.customer.downloads.emptyTitle}
          description={t.customer.downloads.emptyBody}
          action={
            <ButtonLink href="/engineering-tools">{t.customer.downloads.seeTools}</ButtonLink>
          }
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
                      <h2 className="font-bold text-navy">{asset?.name ?? t.customer.downloads.file}</h2>
                      <p className="font-latin mt-1 text-sm text-muted">
                        {asset?.version ? `v${asset.version}` : null}
                        {asset?.size_bytes ? ` · ${fileSize(asset.size_bytes)}` : null}
                        {asset?.released_at ? ` · ${date(asset.released_at, locale)}` : null}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {entitlement.revoked_at ? (
                        <Badge tone="danger">{t.customer.downloads.revokedBadge}</Badge>
                      ) : entitlement.is_usable ? (
                        <Badge tone="success">{t.customer.downloads.usableBadge}</Badge>
                      ) : (
                        <Badge tone="warning">{t.customer.downloads.unusableBadge}</Badge>
                      )}
                      {asset?.is_available ? null : (
                        <Badge tone="neutral">{t.customer.downloads.notReadyBadge}</Badge>
                      )}
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted">{t.customer.downloads.used}</dt>
                      <dd className="text-navy">
                        {number(entitlement.download_count, locale)}
                        {entitlement.max_downloads
                          ? ` / ${number(entitlement.max_downloads, locale)}`
                          : ` (${t.customer.downloads.unlimited})`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">{t.customer.downloads.expiry}</dt>
                      <dd className="text-navy">
                        {entitlement.expires_at
                          ? date(entitlement.expires_at, locale)
                          : t.customer.downloads.noExpiry}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted">SHA-256</dt>
                      <dd className="font-latin break-all text-xs text-navy">
                        {asset?.checksum_sha256 ?? t.customer.downloads.checksumPending}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5">
                    {asset?.is_available && entitlement.is_usable ? (
                      <DownloadButton slug={asset.slug} />
                    ) : (
                      <Callout tone="info">
                        {entitlement.revoked_at
                          ? t.customer.downloads.revoked
                          : !asset?.is_available
                            ? t.customer.downloads.notReleased
                            : t.customer.downloads.unavailable}
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
