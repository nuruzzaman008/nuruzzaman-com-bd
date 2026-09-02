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
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'রিলিজ নোট',
  description:
    'NB Engineering Tools-এর প্রতিটি রিলিজে কী আছে, SHA-256 চেকসাম এবং code-signing অবস্থা।',
  path: '/support/release-notes',
});

const SIGNING_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  signed_timestamped: { label: 'ডিজিটালি সাইনড (টাইমস্ট্যাম্প সহ)', tone: 'success' },
  signed: { label: 'ডিজিটালি সাইনড', tone: 'success' },
  unsigned: { label: 'সাইন করা হয়নি', tone: 'warning' },
  unknown: { label: 'সাইনিং অবস্থা নিশ্চিত করা হয়নি', tone: 'neutral' },
};

const TEST_LABELS: Record<string, string> = {
  release_tested: 'রিলিজ টেস্ট সম্পন্ন',
  internal_tested: 'অভ্যন্তরীণ টেস্ট সম্পন্ন',
  untested: 'রানটাইম টেস্ট রেকর্ড করা হয়নি',
};

export default async function ReleaseNotesPage() {
  const releases = await publicApi<{ data: DownloadAsset[] }>('/releases', {
    tags: ['releases'],
  });

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs
        trail={[
          { name: 'হোম', path: '/' },
          { name: 'সাপোর্ট', path: '/support' },
          { name: 'রিলিজ নোট', path: '/support/release-notes' },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">রিলিজ নোট</h1>
        <p className="mt-3 text-muted">
          ডাউনলোডের পরে সবসময় SHA-256 চেকসাম মিলিয়ে নিন। চেকসাম না মিললে ফাইলটি ব্যবহার
          করবেন না — সাপোর্টে জানান।
        </p>
      </header>

      <Callout tone="info" className="mt-6 max-w-3xl">
        Windows PowerShell-এ চেকসাম বের করতে:{' '}
        <code className="font-latin">Get-FileHash .\file.exe -Algorithm SHA256</code>
      </Callout>

      {releases.data.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="এখনো কোনো রিলিজ প্রকাশ করা হয়নি"
          description="রিলিজ প্রস্তুত হলে ভার্সন, চেকসাম ও সাইনিং অবস্থা এখানে দেখানো হবে।"
        />
      ) : (
        <ul className="mt-8 space-y-6">
          {releases.data.map((release) => {
            const signing = SIGNING_LABELS[release.code_signing_status] ?? SIGNING_LABELS.unknown;

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
                          প্রকাশ:{' '}
                          <time dateTime={isoDate(release.released_at)}>
                            {date(release.released_at)}
                          </time>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge tone={signing.tone}>{signing.label}</Badge>
                      <Badge tone={release.test_status === 'release_tested' ? 'success' : 'neutral'}>
                        {TEST_LABELS[release.test_status] ?? release.test_status}
                      </Badge>
                      <Badge tone={release.is_available ? 'info' : 'warning'}>
                        {release.is_available ? 'ডাউনলোডের জন্য প্রস্তুত' : 'এখনো প্রকাশিত হয়নি'}
                      </Badge>
                    </div>
                  </div>

                  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-navy">ফাইল সাইজ</dt>
                      <dd className="font-latin text-muted">
                        {fileSize(release.size_bytes) ?? 'নির্ধারিত হয়নি'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-semibold text-navy">SHA-256</dt>
                      <dd className="font-latin break-all text-muted">
                        {release.checksum_sha256 ?? 'ফাইল আপলোডের পর প্রকাশ করা হবে'}
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
