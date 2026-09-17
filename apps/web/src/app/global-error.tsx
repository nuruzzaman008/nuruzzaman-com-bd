'use client';

import { useEffect } from 'react';

/**
 * Shown only when the root layout itself fails, so it cannot rely on the
 * layout's fonts, styles or locale - it brings its own html and body.
 */
export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error('Root layout error', error.digest);
  }, [error]);

  return (
    <html lang="bn">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '16px',
          fontFamily: 'system-ui, sans-serif',
          color: '#0b1f33',
          background: '#ffffff',
          textAlign: 'center',
        }}
      >
        <main>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>কিছু একটা ভুল হয়েছে</h1>
          <p style={{ margin: '12px 0 0', color: '#5a6b7e' }}>
            Something went wrong. Please try again.
          </p>
          {error.digest ? (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#5a6b7e' }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => (retry ?? reset)?.()}
            style={{
              marginTop: '24px',
              padding: '10px 20px',
              border: 0,
              borderRadius: '8px',
              background: '#0b1f33',
              color: '#ffffff',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            আবার চেষ্টা করুন / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
