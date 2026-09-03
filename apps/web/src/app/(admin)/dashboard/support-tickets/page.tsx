import type { Metadata } from 'next';
import type { SupportTicket } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';
import { TICKET_STATUS_LABELS, label } from '@/lib/status';

export const metadata: Metadata = privateMetadata('সাপোর্ট টিকিট');

export default async function DashboardSupportTicketsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const searchParams = await props.searchParams;

  const tickets = await sessionApi<{ data: SupportTicket[] }>('/admin/support-tickets', {
    query: { status: searchParams.status },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">সাপোর্ট টিকিট</h1>

      <div className="mt-6">
        <DataTable
          caption="সাপোর্ট টিকিটের তালিকা"
          rows={tickets.data}
          getRowKey={(ticket) => ticket.reference}
          empty={<EmptyState title="কোনো টিকিট নেই" />}
          columns={[
            {
              key: 'reference',
              header: 'রেফারেন্স',
              render: (ticket) => (
                <span className="font-latin font-semibold text-navy">{ticket.reference}</span>
              ),
            },
            { key: 'subject', header: 'বিষয়', render: (ticket) => ticket.subject },
            { key: 'category', header: 'ক্যাটাগরি', render: (ticket) => ticket.category },
            {
              key: 'status',
              header: 'অবস্থা',
              render: (ticket) => (
                <Badge tone={ticket.status === 'resolved' ? 'success' : 'info'}>
                  {label(TICKET_STATUS_LABELS, ticket.status)}
                </Badge>
              ),
            },
            {
              key: 'created',
              header: 'খোলা হয়েছে',
              render: (ticket) => date(ticket.created_at) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
