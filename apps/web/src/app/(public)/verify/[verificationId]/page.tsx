import type { Metadata } from 'next';
import type { Certificate } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { LocaleLink } from '@/components/ui/locale-link';
import { tryPublicApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';
import { buildMetadata } from '@/lib/seo';

type VerifyResult = Certificate & { valid: boolean; reason: string | null };

export async function generateMetadata(
  props: LocalizedPageProps & { params: Promise<{ verificationId: string }> },
): Promise<Metadata> {
  const { t } = pageDictionary(props.locale);
  const { verificationId } = await props.params;

  return buildMetadata({
    title: `${t.pageTitle.verify} — ${verificationId}`,
    description: t.verify.metaDescription,
    path: `/verify/${verificationId}`,
  });
}

/**
 * Public certificate check. It confirms or denies an id and shows nothing about
 * the holder beyond the name printed on the certificate itself.
 */
export default async function VerifyPage(
  props: LocalizedPageProps & { params: Promise<{ verificationId: string }> },
) {
  const { locale, t } = pageDictionary(props.locale);
  const { verificationId } = await props.params;

  const response = await tryPublicApi<{ data: VerifyResult }>(
    `/verify/${encodeURIComponent(verificationId)}`,
    { revalidate: 60 },
  );

  const result = response?.data ?? null;

  return (
    <Container size="narrow" className="py-14">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.pageTitle.verify}</h1>
      <p className="font-latin mt-2 text-sm text-muted">Verification ID: {verificationId}</p>

      <Card className="mt-8 p-6">
        {!result ? (
          <Callout tone="danger" title={t.verify.notFoundTitle} role="alert">
            {t.verify.notFoundBody}
          </Callout>
        ) : result.valid ? (
          <>
            <Badge tone="success">{t.verify.valid}</Badge>
            <dl className="mt-5 space-y-4">
              <div>
                <dt className="text-sm text-muted">{t.verify.recipient}</dt>
                <dd className="text-lg font-bold text-navy">{result.recipient_name}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{t.verify.course}</dt>
                <dd className="font-medium text-navy">
                  {result.course_slug ? (
                    <LocaleLink
                      href={`/courses/${result.course_slug}`}
                      className="hover:underline"
                    >
                      {result.course_title}
                    </LocaleLink>
                  ) : (
                    result.course_title
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{t.verify.issuedOn}</dt>
                <dd className="font-medium text-navy">{date(result.issued_at, locale) ?? '—'}</dd>
              </div>
            </dl>
          </>
        ) : (
          <Callout tone="warning" title={t.verify.revokedTitle} role="alert">
            {t.verify.revokedBody}
          </Callout>
        )}
      </Card>

      <p className="mt-6 text-xs text-muted">
        {t.verify.note}
      </p>
    </Container>
  );
}
