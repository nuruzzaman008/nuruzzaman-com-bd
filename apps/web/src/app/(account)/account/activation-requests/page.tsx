import type { Metadata } from 'next';
import Link from 'next/link';
import type { ActivationRequest } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('অ্যাক্টিভেশন রিকোয়েস্ট');

const TONES: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  submitted: 'info',
  under_review: 'info',
  needs_info: 'warning',
  approved: 'info',
  completed: 'success',
  rejected: 'danger',
};

export default async function ActivationRequestsPage() {
  const requests = await sessionApi<{ data: ActivationRequest[] }>('/account/activation-requests');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">অ্যাক্টিভেশন রিকোয়েস্ট</h1>
        <ButtonLink href="/account/activation-requests/new">নতুন রিকোয়েস্ট</ButtonLink>
      </div>

      <p className="mt-2 text-muted">
        Machine ID এনক্রিপ্ট করে রাখা হয় এবং সবসময় মাস্ক করা অবস্থায় দেখানো হয়।
      </p>

      <div className="mt-6">
        <DataTable
          caption="আপনার অ্যাক্টিভেশন রিকোয়েস্ট"
          rows={requests.data}
          getRowKey={(request) => request.reference}
          empty={
            <EmptyState
              title="কোনো রিকোয়েস্ট নেই"
              description="একটি পরিশোধিত অর্ডার থাকলে Machine ID সহ রিকোয়েস্ট পাঠাতে পারবেন।"
              action={<ButtonLink href="/account/activation-requests/new">রিকোয়েস্ট পাঠান</ButtonLink>}
            />
          }
          columns={[
            {
              key: 'reference',
              header: 'রেফারেন্স',
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
              header: 'অবস্থা',
              render: (request) => (
                <Badge tone={TONES[request.status] ?? 'neutral'}>{request.status}</Badge>
              ),
            },
            {
              key: 'created',
              header: 'জমা',
              render: (request) => date(request.created_at) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
