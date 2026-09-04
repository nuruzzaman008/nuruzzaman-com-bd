import type { Metadata } from 'next';
import type { DownloadAsset } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Prose } from '@/components/ui/prose';
import { EmptyState } from '@/components/ui/states';
import { publicApi } from '@/lib/api/server';
import { date, fileSize, isoDate } from '@/lib/format';
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionary';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: getDictionary('bn').pageTitle.supportReleaseNotes,
  description: getDictionary('bn').release.metaDescription,
  path: '/support/release-notes',
});

type Tone = 'success' | 'warning' | 'neutral';

/**
 * The signing and testing states are facts about a build, so they are read
 * from the release record and only named here - never inferred.
 */
function signingLabel(t: Dictionary, status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'signed_timestamped':
      return { label: t.release.signedTimestamped, tone: 'success' };
    case 'signed':
      return { label: t.release.signed, tone: 'success' };
    case 'unsigned':
      return { label: t.release.unsigned, tone: 'warning' };
    default:
      return { label: t.release.signingUnknown, tone: 'neutral' };
  }
}

function testLabel(t: Dictionary, status: string): string {
  switch (status) {
    case 'release_tested':
      return t.release.releaseTested;
    case 'internal_tested':
      return t.release.internalTested;
    case 'untested':
      return t.release.untested;
    default:
      return status;
  }
}

export default async function ReleaseNotesPage({ locale }: LocalizedPageProps) {
  const { locale: active, t } = pageDictionary(locale);
  const releases = await publicApi<{ data: DownloadAsset[] }>('/releases', {
    tags: ['releases'],
  });

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs
        trail={[
          { name: t.common.home, path: '/' },
          { name: t.pageTitle.support, path: '/support' },
          { name: t.pageTitle.supportReleaseNotes, path: '/support/release-notes' },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
          {t.pageTitle.supportReleaseNotes}
        </h1>
        <p className="mt-3 text-muted">{t.release.intro}</p>
      </header>

      <Callout tone="info" className="mt-6 max-w-3xl">
        {t.release.checksumHowTo}{' '}
        <code className="font-latin">Get-FileHash .\file.exe -Algorithm SHA256</code>
      </Callout>

      {releases.data.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={t.release.emptyTitle}
          description={t.release.emptyDescription}
        />
      ) : (
        <ul className="mt-8 space-y-6">
          {releases.data.map((release) => {
            const signing = signingLabel(t, release.code_signing_status);

            return (
              <li key={release.slug}>
                <Card as="article" className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-navy">
                        {release.name}
                        {release.version ? (
                          <span className="font-latin ms-2 text-sm font-medium text-muted">
                            v{release.version}
                          </span>
                        ) : null}
                      </h2>
                      {release.released_at ? (
                        <p className="mt-1 text-sm text-muted">
                          {t.release.published}:{' '}
                          <time dateTime={isoDate(release.released_at)}>
                            {date(release.released_at, active)}
                          </time>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge tone={signing.tone}>{signing.label}</Badge>
                      <Badge tone={release.test_status === 'release_tested' ? 'success' : 'neutral'}>
                        {testLabel(t, release.test_status)}
                      </Badge>
                      <Badge tone={release.is_available ? 'info' : 'warning'}>
                        {release.is_available ? t.release.available : t.release.notAvailable}
                      </Badge>
                    </div>
                  </div>

                  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-navy">{t.release.fileSize}</dt>
                      <dd className="font-latin text-muted">
                        {fileSize(release.size_bytes) ?? t.release.sizeUnknown}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-semibold text-navy">SHA-256</dt>
                      <dd className="font-latin break-all text-muted">
                        {release.checksum_sha256 ?? t.release.checksumPending}
                      </dd>
                    </div>
                  </dl>

                  {release.release_notes_html ? (
                    <Prose html={release.release_notes_html} className="mt-5 max-w-none" />
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
