'use client';

import { useEffect, useState } from 'react';
import type { PaymentStatus } from '@nuruzzaman/contracts';

import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { statusLabel } from '@/lib/status';

/**
 * Payment result screen.
 *
 * Landing here proves nothing: the order is only settled once a validated
 * gateway callback reaches the API. This component therefore polls the
 * read-only status endpoint for a short while and shows a "confirming" state
 * meanwhile, rather than telling the customer they have paid.
 */
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

export function PaymentResult({
  outcome,
  reference,
}: {
  outcome: 'success' | 'failed' | 'cancelled';
  reference: string | null;
}) {
  const { locale, t } = useLocale();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference || outcome !== 'success') {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async (count: number) => {
      try {
        const response = await api<{ data: PaymentStatus }>(
          `/payments/${encodeURIComponent(reference)}/status`,
        );

        if (cancelled) {
          return;
        }

        setStatus(response.data);
        setAttempts(count);

        if (!response.data.is_settled && !response.data.needs_review && count < MAX_POLLS) {
          timer = setTimeout(() => void poll(count + 1), POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) {
          setError(t.checkout.checkFailed);
        }
      }
    };

    void poll(1);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [outcome, reference, t.checkout.checkFailed]);

  if (outcome === 'cancelled') {
    return (
      <Card className="p-6">
        <Callout tone="warning" title={t.checkout.cancelled} role="status">
          {t.checkout.cancelledBody}
        </Callout>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/cart">{t.checkout.backToCart}</ButtonLink>
          <ButtonLink href="/support" variant="secondary">
            {t.checkout.help}
          </ButtonLink>
        </div>
      </Card>
    );
  }

  if (outcome === 'failed') {
    return (
      <Card className="p-6">
        <Callout tone="danger" title={t.checkout.failed} role="alert">
          {t.checkout.failedBody}
        </Callout>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/checkout">{t.checkout.tryAgain}</ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            {t.checkout.contactUs}
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const settled = status?.is_settled ?? false;
  const needsReview = status?.needs_review ?? false;
  const stillWaiting = !settled && !needsReview && attempts < MAX_POLLS;

  return (
    <Card className="p-6">
      {error ? (
        <Callout tone="danger" role="alert">
          {error}
        </Callout>
      ) : settled ? (
        <Callout tone="success" title={t.checkout.confirmed} role="status">
          {t.checkout.confirmedBody}
        </Callout>
      ) : needsReview ? (
        <Callout tone="warning" title={t.checkout.awaitingConfirmation} role="status">
          {t.checkout.awaitingBody}
        </Callout>
      ) : stillWaiting ? (
        <Callout tone="info" title={t.checkout.confirming} role="status">
          {t.checkout.confirmingBody}
        </Callout>
      ) : (
        <Callout tone="warning" title={t.checkout.notConfirmedYet} role="status">
          {t.checkout.notConfirmedBody}
        </Callout>
      )}

      {status ? (
        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t.checkout.order}</dt>
            <dd className="font-latin font-medium text-navy">{status.order_number}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t.checkout.status}</dt>
            <dd className="font-medium text-navy">
              {statusLabel('order', status.order_status, locale)}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <ButtonLink href="/account/orders">{t.checkout.viewOrders}</ButtonLink>
        <ButtonLink href="/account/downloads" variant="secondary">
          {t.checkout.downloads}
        </ButtonLink>
      </div>
    </Card>
  );
}
