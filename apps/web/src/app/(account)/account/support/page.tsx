import type { Metadata } from 'next';
import type { SupportTicket } from '@nuruzzaman/contracts';

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

  return privateMetadata(t.customer.support.title);
}

export default async function AccountSupportPage() {
  const { locale, t } = await adminDictionary();
  const tickets = await sessionApi<{ data: SupportTicket[] }>('/account/support-tickets');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.customer.support.title}
      </h1>
      <p className="mt-2 text-muted">{t.customer.support.intro}</p>

      <div className="mt-6">
        <DataTable
          caption={t.customer.support.caption}
          rows={tickets.data}
          getRowKey={(ticket) => ticket.reference}
          empty={
            <EmptyState
              title={t.customer.support.emptyTitle}
              description={t.customer.support.emptyBody}
              action={<ButtonLink href="/contact">{t.pageTitle.contact}</ButtonLink>}
            />
          }
          columns={[
            {
              key: 'reference',
              header: t.customer.support.reference,
              render: (ticket) => (
                <span className="font-latin font-semibold text-navy">{ticket.reference}</span>
              ),
            },
            {
              key: 'subject',
              header: t.customer.support.subject,
              render: (ticket) => <span data-authored="true">{ticket.subject}</span>,
            },
            {
              key: 'status',
              header: t.customer.support.status,
              render: (ticket) => (
                <Badge tone={ticket.status === 'resolved' ? 'success' : 'info'}>
                  {statusLabel('ticket', ticket.status, locale)}
                </Badge>
              ),
            },
            {
              key: 'created',
              header: t.customer.support.opened,
              render: (ticket) => date(ticket.created_at, locale) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
