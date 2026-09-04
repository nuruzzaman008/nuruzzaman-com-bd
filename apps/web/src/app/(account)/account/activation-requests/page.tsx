import type { Metadata } from 'next';
import Link from 'next/link';
import type { ActivationRequest } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.customer.activation.title);
}

const TONES: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  submitted: 'info',
  under_review: 'info',
  needs_info: 'warning',
  approved: 'info',
  completed: 'success',
  rejected: 'danger',
};

export default async function ActivationRequestsPage() {
  const { locale, t } = await adminDictionary();
  const requests = await sessionApi<{ data: ActivationRequest[] }>('/account/activation-requests');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
          {t.customer.activation.title}
        </h1>
        <ButtonLink href="/account/activation-requests/new">
          {t.customer.activation.newRequest}
        </ButtonLink>
      </div>

      <p className="mt-2 text-muted">{t.customer.activation.intro}</p>

      <div className="mt-6">
        <DataTable
          caption={t.customer.activation.caption}
          rows={requests.data}
          getRowKey={(request) => request.reference}
          empty={
            <EmptyState
              title={t.customer.activation.emptyTitle}
              description={t.customer.activation.emptyBody}
              action={
                <ButtonLink href="/account/activation-requests/new">
                  {t.customer.activation.sendRequest}
                </ButtonLink>
              }
            />
          }
          columns={[
            {
              key: 'reference',
              header: t.customer.activation.reference,
              render: (request) => (
                <Link
                  href={`/account/activation-requests/${request.reference}`}
                  className="font-latin font-semibold text-blue hover:underline"
                >
                  {request.reference}
                </Link>
              ),
            },
            {
              key: 'machine',
              header: 'Machine ID',
              render: (request) => (
                <span className="font-latin text-muted">{request.machine_id_masked}</span>
              ),
            },
            {
              key: 'status',
              header: t.customer.activation.status,
              render: (request) => (
                <Badge tone={TONES[request.status] ?? 'neutral'}>{statusLabel('activation', request.status, locale)}</Badge>
              ),
            },
            {
              key: 'created',
              header: t.customer.activation.submitted,
              render: (request) => date(request.created_at, locale) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
