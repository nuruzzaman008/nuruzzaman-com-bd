'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/callout';

type Ticket = { reference: string; name: string; mobile: string | null; subject: string; category: string; status: string; messages?: { id: number; author_kind: string; body: string; is_internal: boolean; at: string }[] };
const field = 'mt-1 block w-full rounded border border-line p-3';

export function SupportTickets({ admin = false }: { admin?: boolean }) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const endpoint = admin ? '/admin/support-tickets' : '/account/support-tickets';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await api<{ data: Ticket[]; meta: { last_page: number } }>(endpoint, { query: { page } });
      setTickets(r.data); setLastPage(r.meta.last_page); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load tickets'); }
  }, [endpoint, page]);
  useEffect(() => { void (async () => { await load(); })(); }, [load]);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const values = new FormData(form);
    setBusy(true); setError('');
    try {
      const r = await api<{ data: Ticket }>(endpoint, { method: 'POST', body: Object.fromEntries(values) });
      form.reset(); setSelected(r.data.reference); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create ticket'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><h1 className="text-3xl font-bold">{en ? 'Support tickets' : 'সাপোর্ট টিকিট'}</h1>
    {error && <Callout tone="danger" role="alert">{error}</Callout>}
    {!admin && <details className="rounded border border-line bg-white p-5"><summary className="cursor-pointer font-bold">{en ? 'Create support ticket' : 'নতুন সাপোর্ট টিকিট'}</summary><form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2">
      <label>{en ? 'Name (required)' : 'নাম (আবশ্যক)'}<input name="name" required minLength={2} maxLength={160} autoComplete="name" className={field} /></label>
      <label>{en ? 'Mobile number (required)' : 'মোবাইল নম্বর (আবশ্যক)'}<input name="mobile" type="tel" required pattern="[+]?[0-9]{7,15}" placeholder="01712345678" autoComplete="tel" className={field} /></label>
      <label>{en ? 'Subject' : 'বিষয়'}<input name="subject" required minLength={3} maxLength={255} className={field} /></label>
      <label>{en ? 'Category' : 'বিভাগ'}<select name="category" className={field}>{['general', 'installation', 'activation', 'licence', 'course', 'billing'].map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="sm:col-span-2">{en ? 'Message' : 'বার্তা'}<textarea name="message" required minLength={10} maxLength={5000} rows={4} className={field} /></label>
      <Button type="submit" disabled={busy}>{en ? 'Submit ticket' : 'টিকিট জমা দিন'}</Button>
    </form></details>}
    <Button variant="secondary" onClick={load}>{en ? 'Refresh tickets' : 'টিকিট রিফ্রেশ করুন'}</Button>
    {tickets.length === 0 && <p>{en ? 'No support tickets yet.' : 'এখনো কোনো সাপোর্ট টিকিট নেই।'}</p>}
    <div className="grid gap-3">{tickets.map(t => <Card key={t.reference} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="font-bold">{t.subject}</p><p className="text-sm text-muted">{t.reference} · {t.status}</p>{admin && <p className="mt-1 text-sm">{t.name} · {t.mobile || (en ? 'Mobile not provided on older ticket' : 'পুরোনো টিকিটে মোবাইল দেওয়া হয়নি')}</p>}</div><Button variant="secondary" onClick={() => setSelected(t.reference)}>{en ? 'Open / Reply' : 'খুলুন / উত্তর দিন'}</Button></Card>)}</div>
    {lastPage > 1 && <div className="flex gap-3"><Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span>{page} / {lastPage}</span><Button disabled={page === lastPage} onClick={() => setPage(p => p + 1)}>Next</Button></div>}
    {selected && <TicketConversation key={selected} endpoint={`${endpoint}/${encodeURIComponent(selected)}`} admin={admin} onChanged={load} />}
  </div>;
}

function TicketConversation({ endpoint, admin, onChanged }: { endpoint: string; admin: boolean; onChanged: () => Promise<void> }) {
  const { locale } = useLocale(); const en = locale === 'en';
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [message, setMessage] = useState(''); const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    async function refresh() {
      try { const r = await api<{ data: Ticket }>(endpoint); if (active) setTicket(r.data); }
      catch (e) { if (active) setError(e instanceof Error ? e.message : 'Unable to load conversation'); }
    }
    void refresh(); const timer = setInterval(() => { if (document.visibilityState !== 'hidden') void refresh(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [endpoint]);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const r = await api<{ data: Ticket }>(`${endpoint}/replies`, { method: 'POST', body: { message, ...(admin ? { is_internal: internal } : {}) } });
      setTicket(r.data); setMessage(''); setNotice(en ? 'Reply saved.' : 'উত্তর সংরক্ষণ হয়েছে।'); await onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send reply'); }
    finally { setBusy(false); }
  }
  async function resolve() {
    setBusy(true); setError('');
    try { const r = await api<{ data: Ticket }>(endpoint, { method: 'PATCH', body: { status: 'resolved' } }); setTicket(r.data); await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to resolve ticket'); }
    finally { setBusy(false); }
  }
  return <Card className="space-y-4 border-2 border-blue p-6">
    {error && <Callout tone="danger" role="alert">{error}</Callout>}
    {notice && <p role="status">{notice}</p>}
    {!ticket ? <p>{en ? 'Loading conversation…' : 'কথোপকথন লোড হচ্ছে…'}</p> : <>
      <h2 className="text-xl font-bold">{ticket.subject}</h2><p>{ticket.reference} · {ticket.status}</p><p>{ticket.name} · {ticket.mobile || '—'}</p>
      <div className="space-y-3" aria-label={en ? 'Conversation' : 'কথোপকথন'}>{ticket.messages?.map(m => <div key={m.id} className={`rounded border p-4 ${m.author_kind === 'staff' ? 'bg-blue-soft' : 'bg-white'}`}><p className="text-sm font-semibold">{m.author_kind === 'staff' ? (en ? 'Support team' : 'সাপোর্ট টিম') : ticket.name}{m.is_internal && ' · Internal note'}<time className="ml-3 text-xs text-muted" dateTime={m.at}>{new Date(m.at).toLocaleString(locale)}</time></p><p className="mt-2 whitespace-pre-wrap break-words">{m.body}</p></div>)}</div>
      <form onSubmit={send} className="space-y-3"><label className="block">{en ? 'Your reply' : 'আপনার উত্তর'}<textarea required minLength={2} maxLength={5000} rows={4} className={field} value={message} onChange={e => setMessage(e.target.value)} /></label>
        {admin && <label className="block"><input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} /> {en ? 'Internal note (hidden from customer)' : 'Internal note (customer দেখতে পাবেন না)'}</label>}
        <Button type="submit" disabled={busy}>{en ? 'Send reply' : 'উত্তর পাঠান'}</Button>
      </form>{admin && ticket.status !== 'resolved' && <Button variant="secondary" disabled={busy} onClick={resolve}>{en ? 'Mark resolved' : 'সমাধান হয়েছে'}</Button>}
    </>}
  </Card>;
}
