'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@nuruzzaman/contracts';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

export function AccountModeSwitcher({ mode = 'ecommerce' }: { mode?: 'student' | 'ecommerce' }) {
  const { locale } = useLocale();
  const router = useRouter();
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function switchMode(account_mode: 'student' | 'ecommerce') {
    if (account_mode === mode || busy) return;
    setBusy(true);
    setError('');
    try {
      await api<{ data: User }>('/me', { method: 'PATCH', body: { account_mode } });
      void refresh();
      router.push('/account');
      router.refresh();
    } catch {
      setError(locale === 'bn' ? 'মোড পরিবর্তন হয়নি। আবার চেষ্টা করুন।' : 'Could not switch. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="my-5 rounded-xl border border-line bg-white p-3">
    <p className="mb-2 text-xs font-semibold text-muted">{locale === 'bn' ? 'অ্যাকাউন্ট মোড' : 'Account mode'}</p>
    <div className="grid grid-cols-2 gap-1" aria-label="Account mode">
      {(['student', 'ecommerce'] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} disabled={busy} onClick={() => void switchMode(value)} className={`rounded-lg px-2 py-2 text-sm font-semibold disabled:opacity-60 ${mode === value ? 'bg-blue text-white' : 'text-navy hover:bg-blue-soft'}`}>{value === 'student' ? 'Student' : 'Ecommerce'}</button>)}
    </div>
    <p role="status" className="mt-2 text-xs text-muted">{busy ? (locale === 'bn' ? 'পরিবর্তন হচ্ছে…' : 'Switching…') : (locale === 'bn' ? 'কোর্স ও অর্ডার একই অ্যাকাউন্টে সংরক্ষিত থাকবে।' : 'Your courses and orders stay in this account.')}</p>
    {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
  </div>;
}
