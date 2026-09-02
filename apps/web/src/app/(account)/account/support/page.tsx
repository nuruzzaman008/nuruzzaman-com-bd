import type { Metadata } from 'next';
import type { SupportTicket } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('সাপোর্ট টিকিট');

export default async function AccountSupportPage() {
  const tickets = await sessionApi<{ data: SupportTicket[] }>('/account/support-tickets');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">সাপোর্ট টিকিট</h1>
      <p className="mt-2 text-muted">
        অর্ডারের সঙ্গে যুক্ত টিকিট খুললে উত্তর দ্রুত হয়।
      </p>

      <div className="mt-6">
        <DataTable
          caption="আপনার সাপোর্ট টিকিট"
          rows={tickets.data}
          getRowKey={(ticket) => ticket.reference}
          empty={
            <EmptyState
              title="কোনো টিকিট নেই"
              description="প্রশ্ন থাকলে যোগাযোগ পাতা থেকে বার্তা পাঠান।"
              action={<ButtonLink href="/contact">যোগাযোগ</ButtonLink>}
            />
          }
          columns={[
            {
              key: 'reference',
              header: 'রেফারেন্স',
              render: (ticket) => (
                <span className="font-latin font-semibold text-navy">{ticket.reference}</span>
              ),
            },
            { key: 'subject', header: 'বিষয়', render: (ticket) => ticket.subject },
            {
              key: 'status',
              header: 'অবস্থা',
              render: (ticket) => (
                <Badge tone={ticket.status === 'resolved' ? 'success' : 'info'}>
                  {ticket.status}
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
