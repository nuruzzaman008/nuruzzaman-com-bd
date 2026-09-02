import type { Metadata } from 'next';
import type { Order } from '@nuruzzaman/contracts';

import { ActivationRequestForm } from '@/features/account/activation-request-form';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { sessionApi } from '@/lib/api/server';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('নতুন অ্যাক্টিভেশন রিকোয়েস্ট');

const ELIGIBLE = ['paid', 'fulfilled', 'partially_refunded', 'refund_pending'];

export default async function NewActivationRequestPage() {
  const orders = await sessionApi<{ data: Order[] }>('/account/orders');

  // Only orders that actually grant entitlements can back a request; the API
  // enforces the same rule, this just avoids offering an impossible choice.
  const eligible = orders.data.filter((order) => ELIGIBLE.includes(order.status));

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: 'অ্যাকাউন্ট', path: '/account' },
          { name: 'অ্যাক্টিভেশন', path: '/account/activation-requests' },
          { name: 'নতুন', path: '/account/activation-requests/new' },
        ]}
      />

      <h1 className="mt-4 text-[length:var(--step-h1)] font-bold text-navy">
        নতুন অ্যাক্টিভেশন রিকোয়েস্ট
      </h1>

      <div className="mt-6 max-w-xl">
        <ActivationRequestForm orders={eligible} />
      </div>
    </div>
  );
}
