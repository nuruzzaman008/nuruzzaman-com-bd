import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PaymentResult } from '@/features/commerce/payment-result';
import { Container } from '@/components/ui/container';
import { privateMetadata } from '@/lib/seo';

const OUTCOMES = ['success', 'failed', 'cancelled'] as const;

type Outcome = (typeof OUTCOMES)[number];

export const metadata: Metadata = privateMetadata('পেমেন্টের ফলাফল');

export default async function CheckoutResultPage(props: {
  params: Promise<{ status: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const [{ status }, { ref }] = await Promise.all([props.params, props.searchParams]);

  if (!OUTCOMES.includes(status as Outcome)) {
    notFound();
  }

  return (
    <Container size="narrow" className="py-14">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">পেমেন্টের ফলাফল</h1>

      <div className="mt-8">
        <PaymentResult outcome={status as Outcome} reference={ref ?? null} />
      </div>
    </Container>
  );
}
