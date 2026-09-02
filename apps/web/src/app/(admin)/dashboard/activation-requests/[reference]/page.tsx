import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type ActivationRequest } from '@nuruzzaman/contracts';

import { ActivationReview } from '@/features/dashboard/activation-review';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { sessionApi } from '@/lib/api/server';
import { dateTime } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('রিকোয়েস্ট রিভিউ');

export default async function DashboardActivationRequestPage(props: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await props.params;

  let request: ActivationRequest;

  try {
    const response = await sessionApi<{ data: ActivationRequest }>(
      `/admin/activation-requests/${encodeURIComponent(reference)}`,
    );
    request = response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.isForbidden)) {
      notFound();
    }

    throw error;
  }

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: 'ড্যাশবোর্ড', path: '/dashboard' },
          { name: 'অ্যাক্টিভেশন', path: '/dashboard/activation-requests' },
          { name: request.reference, path: `/dashboard/activation-requests/${request.reference}` },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-latin text-[length:var(--step-h1)] font-bold text-navy">
          {request.reference}
        </h1>
        <Badge tone={request.status === 'completed' ? 'success' : 'info'}>{request.status}</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-bold text-navy">রিকোয়েস্টের তথ্য</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Machine ID (মাস্ক করা)</dt>
                <dd className="font-latin font-medium text-navy">{request.machine_id_masked}</dd>
              </div>
              <div>
                <dt className="text-muted">ধরন</dt>
                <dd className="font-medium text-navy">{request.request_type}</dd>
              </div>
              <div>
                <dt className="text-muted">অর্ডার</dt>
                <dd className="font-latin font-medium text-navy">{request.order_number ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-muted">লাইসেন্স</dt>
                <dd className="font-latin font-medium text-navy">{request.license_code ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-muted">AutoCAD</dt>
                <dd className="font-medium text-navy">{request.autocad_version ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-muted">Windows</dt>
                <dd className="font-medium text-navy">{request.windows_version ?? '-'}</dd>
              </div>
            </dl>

            {request.customer_note ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm text-muted">গ্রাহকের নোট</p>
                <p className="mt-1 text-sm whitespace-pre-line">{request.customer_note}</p>
              </div>
            ) : null}
          </Card>

          <Callout tone="warning">
            এই ওয়েবসাইটে কোনো signing key, token বা recovery ফাইল সংরক্ষণ করা হয় না।
            গ্রাহকের রেসপন্সে কখনো সেরকম কিছু লিখবেন না।
          </Callout>

          {request.timeline?.length ? (
            <Card className="p-5">
              <h2 className="font-bold text-navy">ইতিহাস</h2>
              <ol className="mt-3 space-y-3 text-sm">
                {request.timeline.map((event, index) => (
                  <li key={`${event.to}-${index}`}>
                    <span className="font-latin font-medium text-navy">
                      {event.from ? `${event.from} - ${event.to}` : event.to}
                    </span>
                    {event.note ? <span className="block text-muted">{event.note}</span> : null}
                    <span className="block text-xs text-muted">{dateTime(event.at)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>

        <aside>
          <ActivationReview request={request} />
        </aside>
      </div>
    </div>
  );
}
