import { notFound } from 'next/navigation';
import { sessionApi } from '@/lib/api/server';
import { GrowthHub } from '@/features/growth-hub/growth-hub';

export const metadata = { title: 'My Growth Hub', robots: { index: false, follow: false } };
export default async function Page() {
  const { data: user } = await sessionApi<{ data: { roles: string[] } }>('/me');
  if (!user.roles.includes('super_admin')) notFound();
  return <GrowthHub />;
}
