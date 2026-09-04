import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type ActivationRequest } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { sessionApi } from '@/lib/api/server';
import { dateTime } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.customer.activation.title);
}

export default async function ActivationRequestPage(props: {
  params: Promise<{ reference: string }>;
}) {
  const { locale, t } = await adminDictionary();
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
          { name: t.customer.title, path: '/account' },
          { name: t.customer.activation.breadcrumbSection, path: '/account/activation-requests' },
          { name: request.reference, path: `/account/activation-requests/${request.reference}` },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-latin text-[length:var(--step-h1)] font-bold text-navy">
          {request.reference}
        </h1>
        <Badge tone={request.status === 'completed' ? 'success' : 'info'}>{statusLabel('activation', request.status, locale)}</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          {request.vendor_response ? (
            <Callout tone="success" title={t.customer.activation.vendorResponse}>
              <p className="whitespace-pre-line">{request.vendor_response}</p>
            </Callout>
          ) : (
            <Callout tone="info" title={t.customer.activation.noResponse}>
              {t.customer.activation.noResponseBody}
            </Callout>
          )}

          {request.timeline?.length ? (
            <Card className="p-5">
              <h2 className="font-bold text-navy">{t.customer.activation.history}</h2>
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
                      <span className="block text-xs text-muted">{dateTime(event.at, locale)}</span>
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
                <dt className="text-muted">{t.customer.activation.kind}</dt>
                <dd className="font-medium text-navy">{request.request_type}</dd>
              </div>
              {request.order_number ? (
                <div>
                  <dt className="text-muted">{t.customer.activation.order}</dt>
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
