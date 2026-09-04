import type { Metadata } from 'next';

import { CheckoutForm } from '@/features/commerce/checkout-form';
import { Container } from '@/components/ui/container';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.checkout.title);
}

export default async function CheckoutPage() {
  const { t } = await adminDictionary();

  return (
    <Container className="py-10 sm:py-14">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.checkout.title}</h1>

      <div className="mt-8">
        <CheckoutForm />
      </div>
    </Container>
  );
}
