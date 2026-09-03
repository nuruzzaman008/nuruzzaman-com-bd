import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type ActivationRequest } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { sessionApi } from '@/lib/api/server';
import { dateTime } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';
import { ACTIVATION_STATUS_LABELS, label } from '@/lib/status';

export const metadata: Metadata = privateMetadata('অ্যাক্টিভেশন রিকোয়েস্ট');

export default async function ActivationRequestPage(props: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await props.params;

  let request: ActivationRequest;

  try {
    const response = await sessionApi<{ data: ActivationRequest }>(
      `/account/activation-requests/${encodeURIComponent(reference)}`,
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
          { name: 'অ্যাকাউন্ট', path: '/account' },
          { name: 'অ্যাক্টিভেশন', path: '/account/activation-requests' },
          { name: request.reference, path: `/account/activation-requests/${request.reference}` },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-latin text-[length:var(--step-h1)] font-bold text-navy">
          {request.reference}
        </h1>
        <Badge tone={request.status === 'completed' ? 'success' : 'info'}>{label(ACTIVATION_STATUS_LABELS, request.status)}</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          {request.vendor_response ? (
            <Callout tone="success" title="ভেন্ডর রেসপন্স">
              <p className="whitespace-pre-line">{request.vendor_response}</p>
            </Callout>
          ) : (
            <Callout tone="info" title="এখনো কোনো রেসপন্স নেই">
              রিভিউ শেষ হলে এখানে নিরাপদ নির্দেশনা দেখা যাবে এবং আপনাকে ইমেইল করা হবে।
            </Callout>
          )}

          {request.timeline?.length ? (
            <Card className="p-5">
              <h2 className="font-bold text-navy">ইতিহাস</h2>
              <ol className="mt-3 space-y-3 text-sm">
                {request.timeline.map((event, index) => (
                  <li key={`${event.to}-${index}`} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-blue"
                    />
                    <span>
                      <span className="font-latin block font-medium text-navy">
                        {event.from ? `${event.from} - ${event.to}` : event.to}
                      </span>
                      {event.note ? <span className="block text-muted">{event.note}</span> : null}
                      <span className="block text-xs text-muted">{dateTime(event.at)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>

        <aside>
          <Card className="p-5">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted">Machine ID</dt>
                <dd className="font-latin font-medium text-navy">{request.machine_id_masked}</dd>
              </div>
              <div>
                <dt className="text-muted">ধরন</dt>
                <dd className="font-medium text-navy">{request.request_type}</dd>
              </div>
              {request.order_number ? (
                <div>
                  <dt className="text-muted">অর্ডার</dt>
                  <dd className="font-latin font-medium text-navy">{request.order_number}</dd>
                </div>
              ) : null}
              {request.autocad_version ? (
                <div>
                  <dt className="text-muted">AutoCAD</dt>
                  <dd className="font-medium text-navy">{request.autocad_version}</dd>
                </div>
              ) : null}
              {request.windows_version ? (
                <div>
                  <dt className="text-muted">Windows</dt>
                  <dd className="font-medium text-navy">{request.windows_version}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
