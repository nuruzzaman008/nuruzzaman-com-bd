import type { Metadata } from 'next';

import { CartView } from '@/features/commerce/cart-view';
import { Container } from '@/components/ui/container';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('কার্ট');

export default function CartPage() {
  return (
    <Container className="py-10 sm:py-14">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">কার্ট</h1>
      <p className="mt-2 text-sm text-muted">
        দাম ও মোট হিসাব সবসময় সার্ভারে গণনা করা হয়।
      </p>

      <div className="mt-8">
        <CartView />
      </div>
    </Container>
  );
}
