import { SupportTickets } from '@/features/support/tickets';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata() {
  const { t } = await adminDictionary();
  return privateMetadata(t.customer.support.title);
}

/** `?ticket=REF` - where a "support replied" notification lands - opens that conversation. */
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const { ticket } = await searchParams;
  const reference = ticket && /^[A-Za-z0-9-]{3,40}$/.test(ticket) ? ticket : undefined;

  return <SupportTickets initialTicket={reference} />;
}
