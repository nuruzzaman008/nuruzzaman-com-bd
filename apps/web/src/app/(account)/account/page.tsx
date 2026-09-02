import type { Metadata } from 'next';
import Link from 'next/link';
import type { DownloadEntitlement, Enrollment, Order, User } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { sessionApi } from '@/lib/api/server';
import { date, price } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('অ্যাকাউন্ট');

export default async function AccountOverviewPage() {
  const [me, orders, enrollments, downloads] = await Promise.all([
    sessionApi<{ data: User }>('/me'),
    sessionApi<{ data: Order[] }>('/account/orders'),
    sessionApi<{ data: Enrollment[] }>('/account/courses'),
    sessionApi<{ data: DownloadEntitlement[] }>('/account/downloads'),
  ]);

  const latestOrder = orders.data[0] ?? null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
          স্বাগতম, {me.data.name}
        </h1>
        <p className="mt-2 text-muted">
          আপনার অর্ডার, ডাউনলোড, কোর্স এবং অ্যাক্টিভেশন রিকোয়েস্ট এখান থেকে দেখুন।
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'অর্ডার', value: orders.data.length, href: '/account/orders' },
          { label: 'কোর্স', value: enrollments.data.length, href: '/account/courses' },
          { label: 'ডাউনলোড', value: downloads.data.length, href: '/account/downloads' },
        ].map((stat) => (
          <Card key={stat.label} className="p-5">
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="font-latin mt-1 text-2xl font-bold text-navy">{stat.value}</p>
            <Link href={stat.href} className="mt-2 inline-block text-sm text-blue hover:underline">
              দেখুন
            </Link>
          </Card>
        ))}
      </div>

      {latestOrder ? (
        <Card className="p-6">
          <h2 className="font-bold text-navy">সর্বশেষ অর্ডার</h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-latin font-semibold text-navy">{latestOrder.number}</p>
              <p className="text-sm text-muted">
                {date(latestOrder.placed_at) ?? '—'} ·{' '}
                {price(latestOrder.total_minor, latestOrder.currency)}
              </p>
            </div>
            <Badge tone={latestOrder.status === 'fulfilled' ? 'success' : 'info'}>
              {latestOrder.status}
            </Badge>
          </div>
          <Link
            href={`/account/orders/${latestOrder.number}`}
            className="mt-4 inline-block text-sm text-blue hover:underline"
          >
            অর্ডারের বিস্তারিত
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
