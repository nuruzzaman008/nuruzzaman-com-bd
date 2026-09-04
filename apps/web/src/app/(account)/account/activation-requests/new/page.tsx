import type { Metadata } from 'next';
import type { Order } from '@nuruzzaman/contracts';

import { ActivationRequestForm } from '@/features/account/activation-request-form';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.customer.activation.newTitle);
}

const ELIGIBLE = ['paid', 'fulfilled', 'partially_refunded', 'refund_pending'];

export default async function NewActivationRequestPage() {
  const { t } = await adminDictionary();
  const orders = await sessionApi<{ data: Order[] }>('/account/orders');

  // Only orders that actually grant entitlements can back a request; the API
  // enforces the same rule, this just avoids offering an impossible choice.
  const eligible = orders.data.filter((order) => ELIGIBLE.includes(order.status));

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: t.customer.title, path: '/account' },
          { name: t.customer.activation.breadcrumbSection, path: '/account/activation-requests' },
          { name: t.customer.activation.breadcrumbNew, path: '/account/activation-requests/new' },
        ]}
      />

      <h1 className="mt-4 text-[length:var(--step-h1)] font-bold text-navy">
        {t.customer.activation.newTitle}
      </h1>

      <div className="mt-6 max-w-xl">
        <ActivationRequestForm orders={eligible} />
      </div>
    </div>
  );
}
