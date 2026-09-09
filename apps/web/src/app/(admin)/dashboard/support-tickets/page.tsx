import { SupportTickets } from '@/features/support/tickets';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata() {
  const { t } = await adminDictionary();
  return privateMetadata(t.admin.tickets.title);
}

export default function SupportPage() {
  return <SupportTickets admin />;
}
