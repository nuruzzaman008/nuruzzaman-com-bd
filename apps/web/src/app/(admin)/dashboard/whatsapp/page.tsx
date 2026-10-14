import { notFound } from 'next/navigation';
import { sessionApi } from '@/lib/api/server';
import { WhatsAppInbox } from '@/features/whatsapp/whatsapp-inbox';

export const metadata = { title: 'WhatsApp Inbox', robots: { index: false, follow: false } };

export default async function Page() {
  const { data: user } = await sessionApi<{ data: { roles: string[] } }>('/me');
  if (!user.roles.some((role) => ['admin', 'super_admin'].includes(role))) notFound();
  return <WhatsAppInbox superAdmin={user.roles.includes('super_admin')} />;
}
