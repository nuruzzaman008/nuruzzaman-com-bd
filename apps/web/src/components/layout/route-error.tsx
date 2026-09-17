'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * The fallback every route group shows when a page throws. Without one, an
 * error in the dashboard, account or checkout replaced the whole page with the
 * bare Next.js error screen and no way back.
 */
export function RouteError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    // The digest is the only safe identifier to show; the message may contain
    // details that should not reach a visitor.
    console.error('Route error', error.digest);
  }, [error]);

  return (
    <Container size="narrow" className="py-20 text-center">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
        {t.errors.genericTitle}
      </h1>
      <p className="mt-3 text-muted">{t.errors.genericBody}</p>
      {error.digest ? (
        <p className="font-latin mt-2 text-xs text-muted">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex justify-center gap-3">
        {/* retry() fetches the page again; reset() only re-renders what failed. */}
        <Button onClick={() => (retry ?? reset)?.()}>{t.errors.retry}</Button>
      </div>
    </Container>
  );
}
