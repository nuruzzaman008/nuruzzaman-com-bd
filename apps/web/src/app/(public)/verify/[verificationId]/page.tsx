import type { Metadata } from 'next';
import Link from 'next/link';
import type { Certificate } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { tryPublicApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';

type VerifyResult = Certificate & { valid: boolean; reason: string | null };

export async function generateMetadata(props: {
  params: Promise<{ verificationId: string }>;
}): Promise<Metadata> {
  const { verificationId } = await props.params;

  return buildMetadata({
    title: `সার্টিফিকেট যাচাই — ${verificationId}`,
    description: 'একটি সার্টিফিকেটের verification ID যাচাই করুন।',
    path: `/verify/${verificationId}`,
  });
}

/**
 * Public certificate check. It confirms or denies an id and shows nothing about
 * the holder beyond the name printed on the certificate itself.
 */
export default async function VerifyPage(props: {
  params: Promise<{ verificationId: string }>;
}) {
  const { verificationId } = await props.params;

  const response = await tryPublicApi<{ data: VerifyResult }>(
    `/verify/${encodeURIComponent(verificationId)}`,
    { revalidate: 60 },
  );

  const result = response?.data ?? null;

  return (
    <Container size="narrow" className="py-14">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">সার্টিফিকেট যাচাই</h1>
      <p className="font-latin mt-2 text-sm text-muted">Verification ID: {verificationId}</p>

      <Card className="mt-8 p-6">
        {!result ? (
          <Callout tone="danger" title="এই আইডির কোনো সার্টিফিকেট পাওয়া যায়নি" role="alert">
            আইডিটি আবার মিলিয়ে দেখুন। সন্দেহ হলে সাপোর্টে জানান।
          </Callout>
        ) : result.valid ? (
          <>
            <Badge tone="success">বৈধ সার্টিফিকেট</Badge>
            <dl className="mt-5 space-y-4">
              <div>
                <dt className="text-sm text-muted">প্রাপক</dt>
                <dd className="text-lg font-bold text-navy">{result.recipient_name}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">কোর্স</dt>
                <dd className="font-medium text-navy">
                  {result.course_slug ? (
                    <Link href={`/courses/${result.course_slug}`} className="hover:underline">
                      {result.course_title}
                    </Link>
                  ) : (
                    result.course_title
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">ইস্যুর তারিখ</dt>
                <dd className="font-medium text-navy">{date(result.issued_at) ?? '—'}</dd>
              </div>
            </dl>
          </>
        ) : (
          <Callout tone="warning" title="এই সার্টিফিকেটটি আর বৈধ নয়" role="alert">
            সার্টিফিকেটটি প্রত্যাহার করা হয়েছে।
          </Callout>
        )}
      </Card>

      <p className="mt-6 text-xs text-muted">
        সার্টিফিকেট কেবল কোর্স সম্পন্ন হওয়ার প্রমাণ। এটি কোনো পেশাগত লাইসেন্স নয় এবং
        প্রকৌশল দায়িত্ব হস্তান্তর করে না।
      </p>
    </Container>
  );
}
