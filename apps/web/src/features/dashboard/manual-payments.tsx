'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/browser';
import { price } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/callout';
import type { ManualMethod } from '@/features/commerce/payment-selection';

type Review = { has_proof?: boolean; id: number; number: string; billing_name: string; billing_email: string; method: string; transaction_id: string; sender: string; recipient: string; total_minor: number; currency: string; status: string; review_note: string | null; created_at: string };
export function ManualPayments() {
  const { locale } = useLocale();
  const en = locale === 'en';
  const [rows, setRows] = useState<Review[]>([]);
  const [methods, setMethods] = useState<ManualMethod[]>([]);
  const [filter, setFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await api<{ data: Review[]; last_page: number }>('/admin/manual-payments', { query: { status: filter, page } });
      setRows(r.data); setLastPage(r.last_page);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to load payments'); }
  }, [filter, page]);
  useEffect(() => { void (async () => { await load(); })(); const timer = setInterval(() => { if (document.visibilityState !== 'hidden') void load(); }, 15000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { void api<{ data: ManualMethod[] }>('/admin/payment-methods').then(r => setMethods(r.data)).catch(e => setMessage(e instanceof Error ? e.message : 'Unable to load settings')); }, []);
  async function review(event: React.FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const decision = form.get('decision');
    try {
      const amount = Number(form.get('amount'));
      await api(`/admin/manual-payments/${id}/review`, { method: 'POST', body: { decision, note: form.get('note'), ...(decision === 'approved' ? { confirmed_amount_minor: Math.round(amount * 100) } : {}) } });
      setMessage(en ? 'Review saved. Approved orders are queued for access delivery.' : 'Review সংরক্ষণ হয়েছে। Approved order-এর access দেওয়া হচ্ছে।'); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Review failed'); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { const r = await api<{ data: ManualMethod[] }>('/admin/payment-methods', { method: 'PUT', body: { methods } }); setMethods(r.data); setMessage(en ? 'Payment methods saved.' : 'Payment method সংরক্ষণ হয়েছে।'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  }
  function change(id: string, field: keyof ManualMethod, value: string | boolean) {
    setMethods(old => old.map(m => m.id === id ? { ...m, [field]: value } : m));
  }
  return <div className="space-y-6"><h1 className="text-3xl font-bold">{en ? 'Payment verification' : 'Payment যাচাই'}</h1><p className="text-muted">{en ? 'Check the receiving account statement: transaction ID, sender and exact amount must match. A customer submission alone does not prove payment.' : 'Receiving account-এর statement দেখে transaction ID, sender ও টাকার পরিমাণ মিলিয়ে approve করুন। Customer-এর জমা দেওয়া তথ্যই payment-এর প্রমাণ নয়।'}</p>
    {message && <Callout tone="info" role="status">{message}</Callout>}
    <div className="flex gap-3"><label>{en ? 'Status' : 'অবস্থা'} <select className="rounded border p-2" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label><Button variant="secondary" onClick={load}>{en ? 'Refresh' : 'Refresh'}</Button></div>
    {rows.length === 0 && <p>{en ? 'No payments in this status.' : 'এই অবস্থায় কোনো payment নেই।'}</p>}
    {rows.map(row => <Card key={row.id} className={row.status === 'pending' ? 'border-2 border-amber-400 bg-amber-50 p-6' : 'p-6'}><div className="flex flex-wrap justify-between gap-4"><div><Link className="font-bold text-blue underline" href={`/dashboard/orders/${row.number}`}>{row.number}</Link><p>{row.billing_name} · {row.billing_email}</p></div><strong className="text-xl">{price(row.total_minor, row.currency, locale)}</strong></div><dl className="my-4 grid gap-2 text-sm sm:grid-cols-2"><div>Method: <strong>{row.method.toUpperCase()}</strong></div><div>Transaction ID: <strong>{row.transaction_id}</strong></div><div>Sender: {row.sender}</div><div className="whitespace-pre-wrap">Recipient: {row.recipient}</div><div>Submitted: {row.created_at}</div><div>Status: {row.status}</div></dl>{row.has_proof ? <a className="mb-5 block text-blue underline" href={`/api/v1/admin/manual-payments/${row.id}/proof`} target="_blank" rel="noopener noreferrer"><Image unoptimized src={`/api/v1/admin/manual-payments/${row.id}/proof`} alt={en ? 'Payment screenshot' : 'Payment-এর screenshot'} width={640} height={480} className="mb-2 max-h-64 w-auto rounded border object-contain" />{en ? 'Open full payment screenshot' : 'Payment screenshot বড় করে দেখুন'}</a> : <p className="mb-4 text-sm text-muted">{en ? 'No screenshot attached to this older submission.' : 'এই পুরোনো submission-এ screenshot নেই।'}</p>}{row.status === 'pending' ? <form onSubmit={e => review(e, row.id)} className="grid gap-3 sm:grid-cols-2"><label>Decision<select name="decision" className="mt-1 block w-full rounded border p-2"><option value="approved">Approve verified payment</option><option value="rejected">Reject payment</option></select></label><label>Received amount ({row.currency})<input name="amount" type="number" min="0" step="0.01" className="mt-1 w-full rounded border p-2" /></label><label className="sm:col-span-2">{en ? 'Verification note / rejection reason (visible to customer)' : 'যাচাইয়ের note / reject-এর কারণ (customer দেখতে পাবেন)'}<textarea name="note" required minLength={3} maxLength={500} className="mt-1 w-full rounded border p-2" /></label><label className="sm:col-span-2"><input type="checkbox" required /> {en ? 'I checked the receiving account statement and confirm this decision.' : 'Receiving account-এর statement যাচাই করে এই সিদ্ধান্ত দিচ্ছি।'}</label><Button disabled={busy} type="submit">{en ? 'Save payment review' : 'Payment review সংরক্ষণ করুন'}</Button></form> : <p>{row.review_note}</p>}</Card>)}
    {lastPage > 1 && <div className="flex items-center gap-4"><Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span>{page} / {lastPage}</span><Button disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button></div>}
    {methods.length > 0 && <details className="rounded border border-line bg-white p-5"><summary className="cursor-pointer font-bold">{en ? 'Configure receiving accounts' : 'Receiving account সেট করুন'}</summary><form onSubmit={save} className="mt-6 space-y-6">{methods.map(m => <fieldset key={m.id} className="space-y-3 border-t pt-4"><legend className="font-bold">{m.name}</legend><label className="block"><input type="checkbox" checked={m.enabled} onChange={e => change(m.id, 'enabled', e.target.checked)} /> Enabled</label><label className="block">Receiving account / merchant number / bank details<textarea maxLength={1000} className="mt-1 w-full rounded border p-2" value={m.recipient} onChange={e => change(m.id, 'recipient', e.target.value)} /></label><label className="block">Payment instructions (Send Money / Payment, account name, reference)<textarea maxLength={2000} className="mt-1 w-full rounded border p-2" value={m.instructions} onChange={e => change(m.id, 'instructions', e.target.value)} /></label></fieldset>)}<Button disabled={busy} type="submit">Save receiving accounts</Button></form></details>}
  </div>;
}
