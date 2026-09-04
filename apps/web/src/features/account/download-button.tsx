'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * Requests one protected file.
 *
 * The API decides everything: entitlement, expiry, remaining downloads and the
 * storage path. Object storage answers with a short-lived signed URL; a local
 * private disk streams the bytes back through the same authenticated request.
 */
export function DownloadButton({
  slug,
  disabled,
  label,
}: {
  slug: string;
  disabled?: boolean;
  /** Overrides the default wording; the default follows the reader's language. */
  label?: string;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/account/downloads/${encodeURIComponent(slug)}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json, application/octet-stream',
          'X-XSRF-TOKEN': decodeURIComponent(
            document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1] ?? '',
          ),
        },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;

        setError(body?.error?.message ?? t.customer.downloads.failed);

        return;
      }

      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const body = (await response.json()) as { data: { url: string } };
        window.location.href = body.data.url;

        return;
      }

      // Streamed response: hand the blob to the browser under the server's name.
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const disposition = response.headers.get('content-disposition') ?? '';
      const match = disposition.match(/filename="?([^";]+)"?/);

      anchor.href = url;
      anchor.download = match?.[1] ?? slug;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t.customer.downloads.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button type="button" onClick={download} disabled={disabled || busy}>
        {busy ? t.customer.downloads.preparing : (label ?? t.customer.downloads.download)}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
