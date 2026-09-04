import type { Metadata } from 'next';

import { CartView } from '@/features/commerce/cart-view';
import { Container } from '@/components/ui/container';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.cart.title);
}

export default async function CartPage() {
  const { t } = await adminDictionary();

  return (
    <Container className="py-10 sm:py-14">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.cart.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.cart.serverPricedNote}</p>

      <div className="mt-8">
        <CartView />
      </div>
    </Container>
  );
}
