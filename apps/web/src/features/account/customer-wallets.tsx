'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Product, ProductVariant } from '@nuruzzaman/contracts';
import { AddToCart } from '@/features/catalog/add-to-cart';
import { api } from '@/lib/api/browser';

type License = { license_code: string; product_name: string; status: string };
type View = { data: {
  license_code: string; license_status: string; last_sync: string | null;
  wallet: { balance: number; available_balance: number; reserved_balance: number; status: string } | null;
  devices: { id: number; confirmed_at: string | null; revoked_at: string | null; last_seen_at: string | null }[];
  entries: { transaction_id: string | null; source: string; action_type: string | null; delta: number; balance: number; created_at: string }[];
}; meta: { page: number; last_page: number } };
const button = 'rounded-lg bg-blue px-4 py-2 text-white disabled:opacity-50';

export function CustomerWallets() {
  const [packs, setPacks] = useState<ProductVariant[]>([]);
  const [packsError, setPacksError] = useState(false);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = useRef({ sequence: 0 });
  useEffect(() => {
    let live = true;
    const requests = current.current;
    api<{ data: License[] }>('/account/licenses').then(r => { if (live) setLicenses(r.data); })
      .catch(() => { if (live) setError('Could not load your licenses. Please try again.'); });
    api<{ data: Product }>('/products/nb-credit-refill').then(r => { if (live) setPacks((r.data.variants ?? []).filter(v => v.is_purchasable && (v.credit_amount ?? 0) > 0)); })
      .catch(() => { if (live) setPacksError(true); });
    return () => { live = false; requests.sequence++; };
  }, []);
  async function open(code: string, page = 1) {
    const request = ++current.current.sequence;
    setBusy(true); setError(''); setView(null);
    try {
      const result = await api<View>(`/account/licenses/${encodeURIComponent(code)}/wallet`, { query: { page } });
      if (request === current.current.sequence) setView(result);
    } catch { if (request === current.current.sequence) setError('Could not load this wallet. Please try again.'); }
    finally { if (request === current.current.sequence) setBusy(false); }
  }
  const data = view?.data;
  const selectedCode = data?.license_code;
  useEffect(() => {
    if (!selectedCode) return;
    let active = true;
    async function refreshBalance() {
      try {
        const result = await api<View>(`/account/licenses/${encodeURIComponent(selectedCode!)}/wallet`);
        if (active) setView(result);
      } catch { /* Keep the last confirmed balance during a temporary outage. */ }
    }
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshBalance(); }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selectedCode]);
  return <section className="space-y-5 text-navy">
    <h1 className="text-3xl font-bold">Licenses &amp; Wallets</h1>
    <p>Each license has its own wallet and device connection. These balances belong to NB Online Wallet.</p>
    <Link href="/connect-autocad" className="text-blue underline">Connect AutoCAD</Link>
    <label className="block">Select license<select className="mt-2 block w-full rounded-lg border border-line p-3" defaultValue="" onChange={e => { if (e.target.value) void open(e.target.value); }}>
      <option value="" disabled>Choose a license</option>
      {licenses.map(l => <option key={l.license_code} value={l.license_code}>{l.license_code} â€” {l.product_name} ({l.status})</option>)}
    </select></label>
    {error && <p role="alert">{error}</p>}{busy && <p role="status">Loading walletâ€¦</p>}
    {data && <>
      <h2 className="text-xl font-bold">{data.license_code} Â· {data.license_status}</h2>
      {data.wallet ? <dl className="grid gap-3 sm:grid-cols-3">{Object.entries({ Available: data.wallet.available_balance, Reserved: data.wallet.reserved_balance, Total: data.wallet.balance, 'Wallet status': data.wallet.status, 'Last sync (UTC)': data.last_sync ?? 'Never' }).map(([name, value]) => <div className="rounded-lg border border-line bg-white p-4" key={name}><dt>{name}</dt><dd className="font-semibold">{value}</dd></div>)}</dl> : <p>This license does not have an online wallet. Legacy tokens are not automatically transferred.</p>}
      <section id="buy-tokens" className="rounded-xl border border-line bg-white p-5 space-y-4">
        <h3 className="text-xl font-bold">Buy Tokens / টোকেন কিনুন</h3>
        <p>For license: <strong>{data.license_code}</strong></p>
        <p>Choose a pack → review checkout → pay and upload proof → admin approval. After approval, tokens appear here. In AutoCAD NB ONLINE, use Sync Now or wait for automatic sync while connected.</p>
        <p className="text-sm">পেমেন্ট জমা দিলেই token যোগ হবে না। Admin যাচাই করার পরে যোগ হবে। পুরোনো offline wallet আলাদা থাকবে।</p>
        {data.wallet?.status === 'active' && ['active', 'issued'].includes(data.license_status) ? <>
          {packsError ? <p role="alert">Token prices could not load. Refresh this page before paying.</p> : packs.length ? <div className="grid gap-4 sm:grid-cols-2">{packs.map(pack => <div key={pack.id} className="rounded-lg border border-line p-4 space-y-3">
            <h4 className="font-bold">{pack.credit_amount?.toLocaleString()} Tokens</h4>
            <AddToCart variants={[pack]} checkoutLicense={data.license_code} buttonLabel="Buy tokens / কিনুন" />
          </div>)}</div> : <p>Token packs are currently unavailable. Please contact support.</p>}
        </> : <p>This license needs an active online wallet before buying tokens. Contact support.</p>}
        <div className="flex flex-wrap gap-4"><Link href="/account/orders" className="text-blue underline">Payment status / Orders</Link><button type="button" className="text-blue underline" onClick={() => void open(data.license_code)}>Refresh balance</button></div>
      </section>
      <h3 className="font-bold">Devices</h3>
      {data.devices.map(d => <p key={d.id}>Device #{d.id} â€” {d.revoked_at ? 'Revoked' : d.confirmed_at ? 'Paired' : 'Awaiting confirmation'} Â· Last seen (UTC): {d.last_seen_at ?? 'Never'}</p>)}
      <h3 className="font-bold">Transaction history</h3>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Date (UTC)', 'Type', 'Change', 'Balance', 'Transaction'].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{data.entries.map((e, i) => <tr key={e.transaction_id ?? i} className="border-t border-line"><td className="p-2">{e.created_at}</td><td className="p-2">{e.action_type ?? e.source}</td><td className="p-2">{e.delta}</td><td className="p-2">{e.balance}</td><td className="p-2">{e.transaction_id ?? 'Opening balance'}</td></tr>)}</tbody></table></div>
      {view && <div className="flex gap-3"><button className={button} disabled={busy || view.meta.page <= 1} onClick={() => void open(data.license_code, view.meta.page - 1)}>Previous</button><button className={button} disabled={busy || view.meta.page >= view.meta.last_page} onClick={() => void open(data.license_code, view.meta.page + 1)}>Next</button></div>}
    </>}
  </section>;
}
