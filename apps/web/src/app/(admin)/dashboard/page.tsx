import type { Metadata } from 'next';
import Link from 'next/link';
import type { AdminDashboard } from '@nuruzzaman/contracts';

import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { sessionApi } from '@/lib/api/server';
import { number, price } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('ড্যাশবোর্ড');

export default async function DashboardPage() {
  const response = await sessionApi<{ data: AdminDashboard }>('/admin/dashboard');
  const data = response.data;

  const attention = [
    {
      label: 'ঝুঁকি হিসেবে চিহ্নিত পেমেন্ট',
      value: data.attention.payments_on_risk_hold,
      href: '/dashboard/orders?status=pending_payment',
    },
    {
      label: 'খোলা অ্যাক্টিভেশন রিকোয়েস্ট',
      value: data.attention.activation_requests_open,
      href: '/dashboard/activation-requests',
    },
    {
      label: 'খোলা সাপোর্ট টিকিট',
      value: data.attention.support_tickets_open,
      href: '/dashboard/support-tickets',
    },
    {
      label: 'রিভিউয়ের অপেক্ষায় আর্টিকেল',
      value: data.attention.posts_in_review,
      href: '/dashboard/posts?status=in_review',
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">ড্যাশবোর্ড</h1>
        <p className="mt-2 text-muted">
          গত {number(data.window_days)} দিনের হিসাব। শুধু যাচাই হওয়া পেমেন্ট আয় হিসেবে গণনা করা হয়।
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted">নিষ্পত্তি হওয়া আয়</p>
          <p className="mt-1 text-2xl font-bold text-navy">
            {price(data.revenue.settled_minor, data.revenue.currency)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">ফেরত</p>
          <p className="mt-1 text-2xl font-bold text-navy">
            {price(data.revenue.refunded_minor, data.revenue.currency)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">পরিশোধিত অর্ডার</p>
          <p className="font-latin mt-1 text-2xl font-bold text-navy">
            {number(data.orders.paid)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">সক্রিয় এনরোলমেন্ট</p>
          <p className="font-latin mt-1 text-2xl font-bold text-navy">
            {number(data.learning.active_enrollments)}
          </p>
        </Card>
      </div>

      <section>
        <h2 className="text-[length:var(--step-h2)] font-bold text-navy">মনোযোগ প্রয়োজন</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {attention.map((item) => (
            <li key={item.label}>
              <Card className="flex items-center justify-between gap-4 p-4">
                <Link href={item.href} className="text-sm font-medium text-navy hover:text-blue">
                  {item.label}
                </Link>
                <span
                  className={
                    item.value > 0
                      ? 'font-latin rounded-full bg-amber px-3 py-1 text-sm font-bold text-navy'
                      : 'font-latin rounded-full bg-surface px-3 py-1 text-sm font-bold text-muted'
                  }
                >
                  {number(item.value)}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {data.orders.pending > 0 ? (
        <Callout tone="info">
          {number(data.orders.pending)} টি অর্ডার এখনো পেমেন্টের অপেক্ষায়। Reconciliation প্রতি
          ১৫ মিনিটে গেটওয়ের সঙ্গে মিলিয়ে দেখে।
        </Callout>
      ) : null}
    </div>
  );
}
