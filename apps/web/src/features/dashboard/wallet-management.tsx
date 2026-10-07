'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api/browser';

type Wallet = { id: number; name: string | null; email: string | null; license_code: string; balance: number; available_balance: number; reserved_balance: number; status: string; license_status: string; version: number; last_sync: string | null };
type Entry = { id: number; transaction_id: string | null; action_type: string | null; source: string | null; delta: number; balance: number; reason: string | null; reference_note: string | null; created_by: number | null; payment_id: number | null; order_id: number | null; status_before: string | null; status_after: string | null; created_at: string };
type Device = { id: number; revoked_at: string | null; revocation_reason: string | null; last_seen_at: string | null; confirmed_at: string | null; last_sync_status: string | null; last_sync: string | null; sync_due_at: string | null; expires_at: string | null };
type List = { data: Wallet[]; meta: { page: number; last_page: number; total: number } };
type Sync = { id: string; request_id: string; device_id: number; status: string; accepted_count: number; error_code: string | null; created_at: string; completed_at: string | null };
type Detail = { data: { wallet: Wallet; entries: Entry[]; devices: Device[]; syncs?: Sync[]; can_manage: boolean }; meta: { page: number; last_page: number; device_page: number; device_last_page: number; sync_page?: number; sync_last_page?: number } };
type Action = 'add' | 'deduct' | 'status' | 'license_status' | 'reset_device';
const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2';
const buttonClass = 'rounded-lg bg-blue px-4 py-2 font-semibold text-white disabled:opacity-50';
const time = (value: string | null) => value ? `${value} UTC` : 'Never';

export function WalletManagement() {
  const [list, setList] = useState<List | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('blocked');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const pending = useRef<{ body: string; id: string } | null>(null);
  const selection = useRef(0);

  useEffect(() => {
    let live = true;
    api<List>('/admin/wallets').then(value => { if (live) setList(value); }).catch(e => { if (live) setError(e instanceof Error ? e.message : 'Cannot load wallets.'); });
    return () => { live = false; };
  }, []);

  async function search(page = 1) {
    setLoading(true); setError('');
    try { setList(await api<List>('/admin/wallets', { query: { q: query, page } })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Search failed.'); }
    finally { setLoading(false); }
  }

  async function open(id: number, page = 1, devicePage = 1, syncPage = 1) {
    const request = ++selection.current;
    setLoading(true); setError(''); setAction(null); setNotice('');
    try {
      const result = await api<Detail>(`/admin/wallets/${id}`, { query: { page, device_page: devicePage, sync_page: syncPage } });
      if (request === selection.current) setDetail(result);
    } catch (e) { if (request === selection.current) setError(e instanceof Error ? e.message : 'Cannot load wallet.'); }
    finally { if (request === selection.current) setLoading(false); }
  }

  function choose(next: Action) {
    setAction(next); setReason(''); setReference(''); setAmount(''); setError(''); setNotice(''); pending.current = null;
    setStatus(detail?.data.wallet.status === 'active' ? 'blocked' : 'active');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !action || busy) return;
    const wallet = detail.data.wallet;
    const payload = { action, expected_version: Number(wallet.version), reason: reason.trim(), reference_note: reference.trim(), ...(['status', 'license_status'].includes(action) ? { status } : action === 'reset_device' ? {} : { amount: Number(amount) }) };
    const body = JSON.stringify({ license: wallet.id, ...payload });
    if (pending.current?.body !== body) pending.current = { body, id: crypto.randomUUID() };
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/admin/wallets/${wallet.id}/actions`, { method: 'POST', body: { ...payload, transaction_id: pending.current.id } });
      setAction(null); pending.current = null;
      setNotice('Action saved with an audit trail.');
      try {
        setDetail(await api<Detail>(`/admin/wallets/${wallet.id}`));
        setList(await api<List>('/admin/wallets', { query: { q: query } }));
      } catch { setNotice('Action saved. Refresh the wallet to see its updated balance.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed. Retry unchanged input to safely check the same request.'); }
    finally { setBusy(false); }
  }

  const wallet = detail?.data.wallet;
  return <div className="space-y-6 text-navy">
    <header><h1 className="text-3xl font-bold">Wallet Management</h1><p className="mt-2 text-muted">Search users or licenses, review sync activity and record audited token adjustments.</p></header>
    <form role="search" onSubmit={e => { e.preventDefault(); void search(); }} className="flex max-w-2xl gap-2">
      <label className="sr-only" htmlFor="wallet-search">User name, email or license</label>
      <input id="wallet-search" className={inputClass} value={query} onChange={e => setQuery(e.target.value)} placeholder="User name, email or license" maxLength={150} />
      <button className={buttonClass} disabled={loading || busy}>Search</button>
    </form>
    {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{notice}</p>}
    {loading && <p role="status">Loading wallet information…</p>}
    {list && <section className="overflow-x-auto rounded-xl border border-line bg-white p-4">
      <table className="w-full text-left text-sm"><caption className="mb-3 text-left font-semibold">{list.meta.total} wallets</caption><thead><tr>{['User / Email', 'License', 'Available', 'Reserved', 'Status', 'Actions'].map(x => <th className="p-3" key={x}>{x}</th>)}</tr></thead>
        <tbody>{list.data.map(w => <tr key={w.id} className="border-t border-line"><td className="p-3">{w.name ?? 'Deleted user'}<span className="block text-muted">{w.email ?? '—'}</span></td><td className="p-3">{w.license_code}</td><td className="p-3">{w.available_balance}</td><td className="p-3">{w.reserved_balance}</td><td className="p-3">{w.status}</td><td className="p-3"><button className={buttonClass} disabled={busy || loading} onClick={() => void open(w.id)}>View wallet</button></td></tr>)}</tbody></table>
      {list.data.length === 0 && <p className="p-3 text-muted">No provisioned wallets match. This screen does not automatically migrate existing offline licenses.</p>}
      <div className="mt-3 flex items-center gap-3"><button disabled={busy || loading || list.meta.page <= 1} className={buttonClass} onClick={() => void search(list.meta.page - 1)}>Previous</button><span>Page {list.meta.page} / {list.meta.last_page}</span><button disabled={busy || loading || list.meta.page >= list.meta.last_page} className={buttonClass} onClick={() => void search(list.meta.page + 1)}>Next</button></div>
    </section>}
    {wallet && detail && <section className="space-y-5 rounded-xl border border-line bg-white p-5" aria-label="Selected wallet">
      <h2 className="text-xl font-bold">{wallet.license_code}</h2>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Object.entries({ User: wallet.name, Email: wallet.email, License: wallet.license_code, 'Total balance': wallet.balance, 'Available tokens': wallet.available_balance, 'Reserved tokens': wallet.reserved_balance, 'Wallet status': wallet.status, 'License status': wallet.license_status, 'Last Sync': time(wallet.last_sync) }).map(([label, value]) => <div key={label} className="rounded-lg bg-surface p-3"><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 break-all font-semibold">{value ?? '—'}</dd></div>)}</dl>
      <button className={buttonClass} disabled={busy || loading} onClick={() => void open(wallet.id)}>Refresh wallet</button>
      {detail.data.can_manage && wallet.status !== 'closed' && <div className="flex flex-wrap gap-3"><button className={buttonClass} disabled={busy || loading || wallet.status !== 'active'} onClick={() => choose('add')}>+ Add Token</button><button className={buttonClass} disabled={busy || loading || wallet.status !== 'active'} onClick={() => choose('deduct')}>− Deduct Token</button><button className={buttonClass} disabled={busy || loading} onClick={() => choose('status')}>Block Wallet / Change status</button><button className={buttonClass} disabled={busy || loading} onClick={() => choose('license_status')}>Activate / Suspend / Block license</button><button className={buttonClass} disabled={busy || loading} onClick={() => choose('reset_device')}>Reset Device</button></div>}
      {action && <form onSubmit={submit} className="max-w-xl space-y-4 rounded-lg border border-line p-4"><fieldset disabled={busy} className="space-y-4"><legend className="font-bold">{action === 'reset_device' ? 'Revoke all paired devices and reset binding' : action === 'license_status' ? 'Change license status' : action === 'status' ? 'Change wallet status' : action === 'add' ? 'Add tokens' : 'Deduct available tokens'}</legend>
        {action === 'reset_device' ? <p>Existing device credentials will stop working. The next confirmed PC can activate this license. Unsynced reserved tokens remain held for reconciliation.</p> : action === 'status' || action === 'license_status' ? <label className="block">Status<select className={inputClass} value={status} onChange={e => setStatus(e.target.value)}>{['active', 'suspended', 'blocked'].map(s => <option key={s} value={s}>{s}</option>)}</select></label> : <label className="block">Amount<input className={inputClass} type="number" min={1} max={action === 'deduct' ? Math.min(1000000, wallet.available_balance) : 1000000} step={1} required value={amount} onChange={e => setAmount(e.target.value)} /></label>}
        <label className="block">Reason<textarea className={inputClass} required minLength={3} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <label className="block">Reference note<input className={inputClass} required maxLength={500} value={reference} onChange={e => setReference(e.target.value)} /></label>
        <p className="text-sm text-muted">Your signed-in admin ID is recorded automatically. Reserved tokens remain protected.</p>
        <div className="flex gap-3"><button className={buttonClass} type="submit">{busy ? 'Saving…' : 'Save audited action'}</button><button type="button" className="rounded-lg border border-line px-4 py-2" onClick={() => setAction(null)}>Cancel</button></div>
      </fieldset></form>}
      <h3 className="text-lg font-bold">Transaction history</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Time (UTC)', 'Type / Transaction', 'Change / Balance', 'Admin ID', 'Reason / Reference', 'Status change'].map(x => <th className="p-2" key={x}>{x}</th>)}</tr></thead><tbody>{detail.data.entries.map(e => <tr className="border-t border-line" key={e.id}><td className="p-2">{e.created_at}</td><td className="p-2">{e.action_type ?? e.source ?? 'Legacy'}<small className="block">{e.transaction_id ?? '—'}</small></td><td className="p-2">{e.delta} / {e.balance}</td><td className="p-2">{e.created_by ?? '—'}</td><td className="max-w-xs break-words p-2">{e.reason ?? '—'}<small className="block">{e.reference_note}</small>{e.payment_id && <small className="block">Payment #{e.payment_id} · Order #{e.order_id}</small>}</td><td className="p-2">{e.status_before ? `${e.status_before} → ${e.status_after}` : '—'}</td></tr>)}</tbody></table></div>
      {detail.data.entries.length === 0 && <p>No transactions yet.</p>}
      <div className="flex gap-3"><button className={buttonClass} disabled={busy || loading || detail.meta.page <= 1} onClick={() => void open(wallet.id, detail.meta.page - 1, detail.meta.device_page)}>Previous transactions</button><button className={buttonClass} disabled={busy || loading || detail.meta.page >= detail.meta.last_page} onClick={() => void open(wallet.id, detail.meta.page + 1, detail.meta.device_page)}>Next transactions</button></div>
      <h3 className="text-lg font-bold">Sync history</h3>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Created (UTC)', 'Request ID', 'Device', 'Status', 'Accepted transactions', 'Error', 'Completed (UTC)'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{(detail.data.syncs ?? []).map(sync => <tr key={sync.id} className="border-t border-line"><td className="p-2">{sync.created_at}</td><td className="p-2">{sync.request_id}</td><td className="p-2">#{sync.device_id}</td><td className="p-2">{sync.status}</td><td className="p-2">{sync.accepted_count}</td><td className="p-2">{sync.error_code ?? '—'}</td><td className="p-2">{time(sync.completed_at)}</td></tr>)}</tbody></table></div>
      {!detail.data.syncs?.length && <p>No sync requests yet.</p>}
      <div className="flex gap-3"><button className={buttonClass} disabled={busy || loading || (detail.meta.sync_page ?? 1) <= 1} onClick={() => void open(wallet.id, detail.meta.page, detail.meta.device_page, (detail.meta.sync_page ?? 1) - 1)}>Previous syncs</button><button className={buttonClass} disabled={busy || loading || (detail.meta.sync_page ?? 1) >= (detail.meta.sync_last_page ?? 1)} onClick={() => void open(wallet.id, detail.meta.page, detail.meta.device_page, (detail.meta.sync_page ?? 1) + 1)}>Next syncs</button></div>
      <h3 className="text-lg font-bold">Device sync status</h3>
      <div className="grid gap-3 md:grid-cols-2">{detail.data.devices.map(d => <div key={d.id} className="rounded-lg border border-line p-3"><strong>Device #{d.id}</strong><p>{d.revoked_at ? 'Revoked' : d.confirmed_at ? 'Confirmed' : 'Not confirmed'} · {d.last_sync_status ?? 'Not synced'}</p><p>Last seen: {time(d.last_seen_at)}</p><p>Last sync: {time(d.last_sync)}</p>{d.revoked_at && <p>Revoked: {time(d.revoked_at)} — {d.revocation_reason}</p>}<p>Sync due: {time(d.sync_due_at)}</p><p>Lease expiry: {time(d.expires_at)}</p></div>)}</div>
      {detail.data.devices.length === 0 && <p>No connected devices.</p>}
      <div className="flex gap-3"><button className={buttonClass} disabled={busy || loading || detail.meta.device_page <= 1} onClick={() => void open(wallet.id, detail.meta.page, detail.meta.device_page - 1)}>Previous devices</button><button className={buttonClass} disabled={busy || loading || detail.meta.device_page >= detail.meta.device_last_page} onClick={() => void open(wallet.id, detail.meta.page, detail.meta.device_page + 1)}>Next devices</button></div>
    </section>}
  </div>;
}
