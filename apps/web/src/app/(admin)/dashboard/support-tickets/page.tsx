import type { Metadata } from 'next';
import type { SupportTicket } from '@nuruzzaman/contracts';

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

  return privateMetadata(t.admin.tickets.title);
}

export default async function DashboardSupportTicketsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const searchParams = await props.searchParams;

  const tickets = await sessionApi<{ data: SupportTicket[] }>('/admin/support-tickets', {
    query: { status: searchParams.status },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.admin.tickets.title}
      </h1>

      <div className="mt-6">
        <DataTable
          caption={t.admin.tickets.caption}
          rows={tickets.data}
          getRowKey={(ticket) => ticket.reference}
          empty={<EmptyState title={t.admin.tickets.empty} />}
          columns={[
            {
              key: 'reference',
              header: t.admin.tickets.reference,
              render: (ticket) => (
                <span className="font-latin font-semibold text-navy">{ticket.reference}</span>
              ),
            },
            {
              key: 'subject',
              header: t.admin.tickets.subject,
              render: (ticket) => <span data-authored="true">{ticket.subject}</span>,
            },
            {
              key: 'category',
              header: t.admin.tickets.category,
              render: (ticket) => ticket.category,
            },
            {
              key: 'status',
              header: t.admin.common.status,
              render: (ticket) => (
                <Badge tone={ticket.status === 'resolved' ? 'success' : 'info'}>
                  {statusLabel('ticket', ticket.status, locale)}
                </Badge>
              ),
            },
            {
              key: 'created',
              header: t.admin.tickets.opened,
              render: (ticket) => date(ticket.created_at, locale) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
