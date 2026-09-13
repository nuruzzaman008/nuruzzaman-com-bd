'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

/**
 * "Enrol for free" on a free course's page, in place of the cart.
 *
 * Checkout refuses a zero total, so a free course is joined directly; the
 * API checks again that the course really is free. A visitor who is not
 * signed in is sent to sign in first and brought back here.
 */
export function FreeEnroll({ courseSlug }: { courseSlug: string }) {
  const { t } = useLocale();
  const { user } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enroll() {
    if (!user) {
      router.push(`/login?next=/courses/${courseSlug}`);

      return;
    }

    setBusy(true);
    setError(null);

    try {
      await api(`/learn/${encodeURIComponent(courseSlug)}/enroll-free`, { method: 'POST' });
      router.push(`/learn/${courseSlug}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.course.enrollFreeFailed);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => void enroll()}
        disabled={busy}
      >
        {busy ? t.course.enrollingFree : t.course.enrollFree}
      </Button>
      <p className="text-xs text-muted">{t.course.freeCourseNote}</p>
      {error ? (
        <Callout tone="danger" role="alert">
          {error}
        </Callout>
      ) : null}
    </div>
  );
}
