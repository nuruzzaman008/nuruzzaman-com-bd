'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/callout';
import { ChatThread } from '@/features/messages/chat-thread';

type Ticket = { reference: string; name: string; mobile: string | null; subject: string; category: string; status: string; messages?: { id: number; author_kind: string; body: string; is_internal: boolean; at: string }[] };
const field = 'mt-1 block w-full rounded border border-line p-3';

/**
 * Joins the parts that are actually there, separated by a middle dot.
 *
 * The admin line rendered `{name}·{mobile}` unconditionally, so a ticket the
 * API returns without those fields showed a bare leading separator: the panel
 * read "· —" and said nothing at all about who had written in.
 */
function meta(...parts: (string | null | undefined)[]): string {
  return parts.filter((part) => part && part.trim()).join(' · ');
}

export function SupportTickets({ admin = false, initialTicket }: { admin?: boolean; initialTicket?: string }) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const endpoint = admin ? '/admin/support-tickets' : '/account/support-tickets';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  // A notification links here with ?ticket=REF, which opens that conversation.
  const [selected, setSelected] = useState<string | null>(initialTicket ?? null);
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
    {/* The open ticket as a chat, above the list so it is seen at once. */}
    {selected && <div className="h-[34rem] overflow-hidden rounded-xl border-2 border-blue bg-white">
      <ChatThread
        key={selected}
        source={admin ? { scope: 'admin', kind: 'ticket', key: selected } : { scope: 'me', kind: 'ticket', key: selected }}
        onChanged={() => void load()}
      />
    </div>}
    {tickets.length === 0 && <p>{en ? 'No support tickets yet.' : 'এখনো কোনো সাপোর্ট টিকিট নেই।'}</p>}
    <div className="grid gap-3">{tickets.map(t => <Card key={t.reference} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="font-bold">{t.subject}</p><p className="text-sm text-muted">{meta(t.reference, t.status, t.category)}</p>{admin && <p className="mt-1 text-sm font-medium">{meta(t.name, t.mobile || (en ? 'Mobile not provided on older ticket' : 'পুরোনো টিকিটে মোবাইল দেওয়া হয়নি'))}</p>}</div><Button variant="secondary" onClick={() => setSelected(t.reference)}>{en ? 'Open / Reply' : 'খুলুন / উত্তর দিন'}</Button></Card>)}</div>
    {lastPage > 1 && <div className="flex gap-3"><Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span>{page} / {lastPage}</span><Button disabled={page === lastPage} onClick={() => setPage(p => p + 1)}>Next</Button></div>}
  </div>;
}
