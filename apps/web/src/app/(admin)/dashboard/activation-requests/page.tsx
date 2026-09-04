import type { Metadata } from 'next';
import Link from 'next/link';
import type { ActivationRequest } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.activations.title);
}

const STATUSES = ['submitted', 'under_review', 'needs_info', 'approved', 'completed', 'rejected'];

export default async function DashboardActivationRequestsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const searchParams = await props.searchParams;

  const requests = await sessionApi<{ data: ActivationRequest[] }>('/admin/activation-requests', {
    query: { status: searchParams.status },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.admin.activations.title}
      </h1>
      <p className="mt-2 text-muted">{t.admin.activations.maskNote}</p>

      <nav aria-label={t.admin.filterByStatus} className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/dashboard/activation-requests"
          className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
        >
          {t.admin.common.all}
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/dashboard/activation-requests?status=${status}`}
            className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
          >
            {statusLabel('activation', status, locale)}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        <DataTable
          caption={t.admin.activations.caption}
          rows={requests.data}
          getRowKey={(request) => request.reference}
          empty={<EmptyState title={t.admin.activations.empty} />}
          columns={[
            {
              key: 'reference',
              header: t.admin.activations.reference,
              render: (request) => (
                <Link
                  href={`/dashboard/activation-requests/${request.reference}`}
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
              key: 'type',
              header: t.admin.common.type,
              render: (request) => request.request_type,
            },
            {
              key: 'status',
              header: t.admin.common.status,
              render: (request) => (
                <Badge tone={request.status === 'completed' ? 'success' : 'info'}>
                  {statusLabel('activation', request.status, locale)}
                </Badge>
              ),
            },
            {
              key: 'created',
              header: t.admin.activations.submitted,
              render: (request) => date(request.created_at, locale) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
