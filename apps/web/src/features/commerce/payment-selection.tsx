'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Order } from '@nuruzzaman/contracts';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { price } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/callout';

export type ManualMethod = { id: string; name: string; enabled: boolean; recipient: string; instructions: string };
type Submission = { id: number; method: string; transaction_id: string; status: string; review_note: string | null };
type PaymentData = { order: Order; methods: ManualMethod[]; gateway_enabled: boolean; gateway_test_mode: boolean; submissions: Submission[] };

export function PaymentSelection({ number }: { number: string }) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const [data, setData] = useState<PaymentData | null>(null);
  const [method, setMethod] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gatewayKey] = useState(() => crypto.randomUUID());
  const endpoint = `/checkout/orders/${encodeURIComponent(number)}/payment`;
  const load = useCallback(async () => {
    try { setData((await api<{ data: PaymentData }>(endpoint)).data); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load payment.'); }
  }, [endpoint]);
  useEffect(() => { void (async () => { await load(); })(); }, [load]);
  useEffect(() => {
    if (!data?.submissions.some(s => s.status === 'pending')) return;
    const timer = setInterval(() => { void load(); }, 15000);
    return () => clearInterval(timer);
  }, [data, load]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    form.set('method', method);
    try {
      const response = await api<{ data: PaymentData }>(`${endpoint}/manual`, { method: 'POST', body: form });
      setData(response.data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Submission failed.'); }
    finally { setBusy(false); }
  }
  async function online() {
    setBusy(true); setError('');
    try {
      const response = await api<{ data: { redirect_url: string } }>(`${endpoint}/gateway`, { method: 'POST', idempotencyKey: gatewayKey });
      window.location.assign(response.data.redirect_url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Payment unavailable.'); setBusy(false); }
  }
  const selected = data?.methods.find(m => m.id === method);
  const pending = data?.submissions.some(s => s.status === 'pending');
  const paid = data && ['paid', 'fulfilled', 'partially_refunded'].includes(data.order.status);
  return <div className="space-y-6">
    {error && <Callout tone="danger" role="alert">{error} <Button onClick={load}>{en ? 'Retry' : 'আবার চেষ্টা করুন'}</Button></Callout>}
    {!data ? <p>{en ? 'Loading payment…' : 'Payment লোড হচ্ছে…'}</p> : <>
      <Card className="p-6"><p className="text-sm text-muted">{en ? 'Order' : 'অর্ডার'} {data.order.number}</p><p className="mt-2 text-3xl font-bold">{price(data.order.total_minor, data.order.currency, locale)}</p><ul className="mt-3 text-sm">{data.order.items?.map((item, i) => <li key={i}>{item.product_name} × {item.quantity}</li>)}</ul></Card>
      {paid ? <Callout tone="success">{en ? 'Payment approved. Your purchases are being made available in your account.' : 'Payment approve হয়েছে। আপনার account-এ কেনা course/product-এর access দেওয়া হচ্ছে।'} <Link className="underline" href="/account">{en ? 'Open account' : 'Account খুলুন'}</Link></Callout> : pending ? <Callout tone="info">{en ? 'Payment submitted — awaiting admin verification. Please do not pay again. Access is granted only after approval.' : 'Payment জমা হয়েছে—admin যাচাই করছেন। আবার payment করবেন না। Approve হওয়ার পরই access পাবেন।'} <Button onClick={load}>{en ? 'Check status' : 'Status দেখুন'}</Button></Callout> : data.order.status === 'pending_payment' ? <div className={data.gateway_enabled ? "grid gap-6 lg:grid-cols-2" : "grid gap-6"}>
        {data.gateway_enabled && <Card className="p-6"><h2 className="text-xl font-bold">{en ? 'International & Bangladeshi cards' : 'International ও Bangladeshi cards'}</h2><p className="mt-3 text-muted">{en ? 'Pay on SSLCOMMERZ’s secure hosted page. Supported local cards, international cards and banking options depend on the merchant gateway. We do not collect card details.' : 'SSLCOMMERZ-এর secure page-এ payment করুন। Local/international card ও banking option merchant gateway-এর ওপর নির্ভর করে। এখানে card details নেওয়া হয় না।'}</p>{data.gateway_test_mode && data.gateway_enabled && <p className="mt-3 font-semibold text-amber-700">Sandbox — test payments only</p>}<Button className="mt-5" disabled={busy || !data.gateway_enabled} onClick={online}>{en ? 'Continue to secure card payment' : 'Secure card payment করুন'}</Button>{!data.gateway_enabled && <p className="mt-3 text-sm text-muted">{en ? 'Online card payment is not enabled yet.' : 'Online card payment এখনো চালু হয়নি।'}</p>}</Card>}
        <Card className="p-6"><h2 className="text-xl font-bold">{en ? 'Mobile banking / Bank transfer' : 'Mobile banking / Bank transfer'}</h2><p className="mt-2 text-sm text-muted">{en ? 'Send the exact order total, then submit the transaction for manual verification.' : 'অর্ডারের সঠিক পরিমাণ পাঠিয়ে transaction-এর তথ্য জমা দিন। Admin যাচাই করবেন।'}</p><div className="mt-4 flex flex-wrap gap-2">{data.methods.map(m => <Button key={m.id} variant={m.id === method ? 'primary' : 'secondary'} disabled={!m.enabled || busy} onClick={() => setMethod(m.id)}>{m.name}</Button>)}</div>{!data.methods.some(m => m.enabled) && <p className="mt-4 text-sm">{en ? 'Receiving accounts are being configured. Contact support before sending money.' : 'Receiving account এখনো সেট করা হয়নি। টাকা পাঠানোর আগে support-এ যোগাযোগ করুন।'}</p>}
          {selected?.enabled && <form onSubmit={submit} className="mt-5 space-y-4"><div className="whitespace-pre-wrap rounded-lg bg-blue-soft p-4"><strong>{selected.name} — {en ? 'Receiving account' : 'Receiving account'}</strong><p>{selected.recipient || (en ? 'Receiving account not provided. Contact support before sending money. If you already paid to a verified account, submit your evidence below.' : 'Receiving account দেওয়া হয়নি। টাকা পাঠানোর আগে support-এ যোগাযোগ করুন। আগে যাচাই করা account-এ payment করে থাকলে নিচে প্রমাণ জমা দিন।')}</p><p className="mt-2 text-sm">{selected.instructions}</p></div><label className="block">{en ? 'Sender mobile / account number' : 'যে mobile/account থেকে পাঠিয়েছেন'}<input className="mt-1 w-full rounded border border-line p-3" required minLength={4} maxLength={100} name="sender" /></label><label className="block">Transaction ID<input className="mt-1 w-full rounded border border-line p-3" required minLength={4} maxLength={100} pattern="[A-Za-z0-9\-]+" name="transaction_id" /></label><label className="block">{en ? 'Payment screenshot (required)' : 'Payment-এর screenshot (আবশ্যক)'}<input type="file" name="proof" accept="image/jpeg,image/png,image/webp" required className="mt-2 block w-full rounded border border-line p-3" /><span className="mt-1 block text-sm text-muted">{en ? 'JPG, PNG or WebP · Maximum 5 MB. Show transaction ID, amount and date. Only authorized admins can view this proof.' : 'JPG, PNG বা WebP · সর্বোচ্চ 5 MB। Transaction ID, টাকা ও তারিখ দেখা যেতে হবে। শুধু অনুমোদিত admin এই প্রমাণ দেখতে পারবেন।'}</span></label><p className="text-xs text-muted">{en ? 'Never enter your PIN, password or OTP.' : 'PIN, password বা OTP দেবেন না।'}</p><Button type="submit" disabled={busy}>{busy ? '…' : en ? 'Submit for verification' : 'যাচাইয়ের জন্য জমা দিন'}</Button></form>}
        </Card>
      </div> : <Callout tone="info">{en ? 'This order is no longer awaiting payment.' : 'এই order এখন payment গ্রহণের অবস্থায় নেই।'}</Callout>}
      {data.submissions.length > 0 && <section><h2 className="font-bold">{en ? 'Payment history' : 'Payment history'}</h2>{data.submissions.map(s => <Card key={s.id} className="mt-3 p-4"><p>{s.method.toUpperCase()} · {s.transaction_id} · <strong>{s.status}</strong></p>{s.review_note && <p className="mt-2">{s.review_note}</p>}</Card>)}</section>}
    </>}
  </div>;
}
