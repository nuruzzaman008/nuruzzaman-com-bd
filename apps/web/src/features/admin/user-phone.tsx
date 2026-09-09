'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { Button } from '@/components/ui/button';

export function UserPhone({ id, phone }: { id: number; phone: string | null }) {
  const { locale } = useLocale(); const en = locale === 'en';
  const router = useRouter();
  const [value, setValue] = useState(phone || '');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await api(`/admin/users/${id}`, { method: 'PATCH', body: { phone: value } }); setMessage(en ? 'Phone saved.' : 'নম্বর সংরক্ষণ হয়েছে।'); router.refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save phone'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="min-w-56 space-y-2">
    {!phone && <p className="text-sm font-semibold text-amber-700">{en ? 'Phone required — please add' : 'ফোন নম্বর নেই — যোগ করুন'}</p>}
    <label className="block"><span className="sr-only">{en ? 'Mobile number (required)' : 'মোবাইল নম্বর (আবশ্যক)'}</span><input className="w-full rounded border border-line p-2" type="tel" required pattern="[+]?[0-9]{7,15}" maxLength={16} value={value} onChange={e => setValue(e.target.value)} placeholder="01712345678" /></label>
    <Button type="submit" disabled={busy}>{en ? 'Save phone' : 'নম্বর সংরক্ষণ'}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
