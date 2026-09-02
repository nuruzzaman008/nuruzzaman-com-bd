'use client';

import { useEffect, useState } from 'react';
import type { PaymentStatus } from '@nuruzzaman/contracts';

import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api/browser';

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
          setError('পেমেন্টের অবস্থা যাচাই করা যায়নি।');
        }
      }
    };

    void poll(1);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [outcome, reference]);

  if (outcome === 'cancelled') {
    return (
      <Card className="p-6">
        <Callout tone="warning" title="পেমেন্ট বাতিল করা হয়েছে" role="status">
          আপনার কার্ট অক্ষত আছে। চাইলে আবার চেকআউট করতে পারেন।
        </Callout>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/cart">কার্টে ফিরুন</ButtonLink>
          <ButtonLink href="/support" variant="secondary">
            সহায়তা
          </ButtonLink>
        </div>
      </Card>
    );
  }

  if (outcome === 'failed') {
    return (
      <Card className="p-6">
        <Callout tone="danger" title="পেমেন্ট সম্পন্ন হয়নি" role="alert">
          কোনো টাকা কাটা হয়নি। ভিন্ন কার্ড বা মাধ্যম দিয়ে আবার চেষ্টা করতে পারেন।
        </Callout>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/checkout">আবার চেষ্টা করুন</ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            যোগাযোগ করুন
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
        <Callout tone="success" title="পেমেন্ট নিশ্চিত হয়েছে" role="status">
          আপনার অর্ডার প্রস্তুত করা হচ্ছে। ডাউনলোড ও কোর্স অ্যাক্সেস অ্যাকাউন্টে যুক্ত হবে।
        </Callout>
      ) : needsReview ? (
        <Callout tone="warning" title="পেমেন্ট যাচাইয়ের অপেক্ষায়" role="status">
          গেটওয়ে এই লেনদেনটি ম্যানুয়াল যাচাইয়ের জন্য চিহ্নিত করেছে। যাচাই শেষ হলে
          অ্যাকাউন্টে অ্যাক্সেস যুক্ত হবে এবং আপনাকে ইমেইল করা হবে।
        </Callout>
      ) : stillWaiting ? (
        <Callout tone="info" title="নিশ্চিত করা হচ্ছে" role="status">
          গেটওয়ে থেকে সার্ভার-টু-সার্ভার নিশ্চিতকরণের অপেক্ষা করা হচ্ছে। এই পাতাটি খোলা
          রাখুন; সাধারণত কয়েক সেকেন্ড লাগে।
        </Callout>
      ) : (
        <Callout tone="warning" title="এখনো নিশ্চিত হয়নি" role="status">
          নিশ্চিতকরণ আসতে দেরি হচ্ছে। টাকা কেটে থাকলে স্বয়ংক্রিয় reconciliation প্রক্রিয়া
          এটি ধরে ফেলবে; অ্যাকাউন্টের অর্ডার পাতায় অবস্থা দেখতে পারবেন।
        </Callout>
      )}

      {status ? (
        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">অর্ডার</dt>
            <dd className="font-latin font-medium text-navy">{status.order_number}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">অবস্থা</dt>
            <dd className="font-latin font-medium text-navy">{status.order_status}</dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <ButtonLink href="/account/orders">অর্ডার দেখুন</ButtonLink>
        <ButtonLink href="/account/downloads" variant="secondary">
          ডাউনলোড
        </ButtonLink>
      </div>
    </Card>
  );
}
