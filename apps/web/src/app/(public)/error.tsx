'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only safe identifier to show; the message may contain
    // details that should not reach a visitor.
    console.error('Public route error', error.digest);
  }, [error]);

  return (
    <Container size="narrow" className="py-20 text-center">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">কিছু একটা ভুল হয়েছে</h1>
      <p className="mt-3 text-muted">
        পাতাটি লোড করা যায়নি। আবার চেষ্টা করুন, সমস্যা থাকলে সাপোর্টে জানান।
      </p>
      {error.digest ? (
        <p className="font-latin mt-2 text-xs text-muted">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>আবার চেষ্টা করুন</Button>
      </div>
    </Container>
  );
}
