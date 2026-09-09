'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

export function PendingPaymentAlert() {
  const { locale } = useLocale();
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let loading = false;
    async function refresh() {
      if (loading || document.visibilityState === 'hidden') return;
      loading = true;
      try {
        const response = await api<{ data: { pending_count: number } }>('/admin/manual-payments/pending-count');
        if (!cancelled) { setCount(response.data.pending_count); setFailed(false); }
      } catch { if (!cancelled) setFailed(true); }
      finally { loading = false; }
    }
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  if (!count && !failed) return null;
  return <div role="status" aria-live="polite" className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 p-5 text-navy shadow-sm">
    <Link href="/dashboard/payments" className="flex flex-wrap items-center justify-between gap-3">
      <span><strong className="text-lg">{count ? (locale === 'en' ? `${count} payment(s) awaiting verification` : `${count.toLocaleString('bn-BD')}টি payment যাচাইয়ের অপেক্ষায়`) : (locale === 'en' ? 'Payment status unavailable' : 'Payment status পাওয়া যাচ্ছে না')}</strong><span className="mt-1 block text-sm">{locale === 'en' ? 'Open the review queue to verify and approve customer payments.' : 'Customer-এর payment যাচাই ও approve করতে review list খুলুন।'}</span></span>
      <span className="rounded-lg bg-amber-400 px-4 py-2 font-bold">{locale === 'en' ? 'Review payments →' : 'Payment যাচাই করুন →'}</span>
    </Link>
    {failed && <p className="mt-2 text-sm">{locale === 'en' ? 'Could not refresh the count. Please open the payment list for the latest status.' : 'Count refresh হয়নি। সর্বশেষ status দেখতে payment list খুলুন।'}</p>}
  </div>;
}
