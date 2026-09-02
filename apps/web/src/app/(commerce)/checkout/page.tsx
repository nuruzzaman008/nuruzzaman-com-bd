import type { Metadata } from 'next';

import { CheckoutForm } from '@/features/commerce/checkout-form';
import { Container } from '@/components/ui/container';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('চেকআউট');

export default function CheckoutPage() {
  return (
    <Container className="py-10 sm:py-14">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">চেকআউট</h1>

      <div className="mt-8">
        <CheckoutForm />
      </div>
    </Container>
  );
}
