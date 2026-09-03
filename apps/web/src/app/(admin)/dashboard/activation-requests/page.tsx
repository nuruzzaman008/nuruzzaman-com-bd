import type { Metadata } from 'next';
import Link from 'next/link';
import type { ActivationRequest } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';
import { ACTIVATION_STATUS_LABELS, label } from '@/lib/status';

export const metadata: Metadata = privateMetadata('অ্যাক্টিভেশন রিকোয়েস্ট');

const STATUSES = ['submitted', 'under_review', 'needs_info', 'approved', 'completed', 'rejected'];

export default async function DashboardActivationRequestsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const searchParams = await props.searchParams;

  const requests = await sessionApi<{ data: ActivationRequest[] }>('/admin/activation-requests', {
    query: { status: searchParams.status },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">অ্যাক্টিভেশন রিকোয়েস্ট</h1>
      <p className="mt-2 text-muted">
        Machine ID সবসময় মাস্ক করা অবস্থায় দেখানো হয়; সম্পূর্ণ মান সার্ভারে এনক্রিপ্ট করা থাকে।
      </p>

      <nav aria-label="অবস্থা অনুযায়ী ছাঁকুন" className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/dashboard/activation-requests"
          className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
        >
          সব
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/dashboard/activation-requests?status=${status}`}
            className="font-latin inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-sm font-medium text-navy hover:border-blue"
          >
            {status}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        <DataTable
          caption="অ্যাক্টিভেশন রিকোয়েস্টের তালিকা"
          rows={requests.data}
          getRowKey={(request) => request.reference}
          empty={<EmptyState title="কোনো রিকোয়েস্ট নেই" />}
          columns={[
            {
              key: 'reference',
              header: 'রেফারেন্স',
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
            { key: 'type', header: 'ধরন', render: (request) => request.request_type },
            {
              key: 'status',
              header: 'অবস্থা',
              render: (request) => (
                <Badge tone={request.status === 'completed' ? 'success' : 'info'}>
                  {label(ACTIVATION_STATUS_LABELS, request.status)}
                </Badge>
              ),
            },
            { key: 'created', header: 'জমা', render: (request) => date(request.created_at) ?? '—' },
          ]}
        />
      </div>
    </div>
  );
}
