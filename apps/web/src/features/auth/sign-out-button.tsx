'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';

/**
 * Ends the session.
 *
 * The API clears the session cookie and invalidates the session server-side;
 * this only asks it to. `router.refresh()` afterwards discards the cached
 * server-rendered shell, so the header stops showing the account link even
 * though the page was not reloaded.
 *
 * A failed request still sends the visitor home rather than leaving them on a
 * page they believe they have left. The cookie may survive that, so the message
 * says so instead of pretending the sign-out worked.
 */
export function SignOutButton({
  className,
  variant = 'default',
}: {
  className?: string;
  /** `inverse` is for the navy admin sidebar, where the default is invisible. */
  variant?: 'default' | 'inverse';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setBusy(true);
    setFailed(false);

    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      setFailed(true);
    }

    router.replace('/');
    router.refresh();
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className={cn(
          'inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60',
          variant === 'inverse'
            ? 'text-white/80 hover:bg-white/10 hover:text-white'
            : 'text-navy hover:bg-blue-soft hover:text-blue',
        )}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2" />
          <path d="M18 15l3-3-3-3M21 12H10" />
        </svg>
        {busy ? 'সাইন আউট হচ্ছে…' : 'সাইন আউট'}
      </button>

      {failed ? (
        <p className="mt-2 px-3 text-xs text-danger">
          সার্ভারে পৌঁছানো যায়নি, তাই সেশন এখনো বন্ধ নাও হতে পারে। নিরাপত্তার জন্য
          ব্রাউজার বন্ধ করুন বা আবার চেষ্টা করুন।
        </p>
      ) : null}
    </div>
  );
}
