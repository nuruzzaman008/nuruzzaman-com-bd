'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api/browser';

export default function ConnectDevicePage() {
  const [licenses, setLicenses] = useState<{ license_code: string; product_name: string }[]>([]);
  const [message, setMessage] = useState('Loading your purchased licenses…');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ data: typeof licenses }>('/account/licenses')
      .then((result) => { setLicenses(result.data); setMessage('Confirm only if you started NBONLINECONNECT on your own computer.'); })
      .catch(() => setMessage('Please sign in with the account that purchased your license.'));
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = new URLSearchParams(window.location.hash.slice(1)).get('code');
    setBusy(true);
    try {
      if (!code) throw new Error('Run NBONLINECONNECT in AutoCAD to open a new connection link.');
      await api('/account/connect-device', { method: 'POST', body: { code, license_code: form.get('license_code') } });
      window.history.replaceState(null, '', window.location.pathname);
      setMessage('Computer connected. Keep AutoCAD open: activation and paid token refills will synchronize when the signing service is online.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection failed.'); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-xl space-y-6 py-10">
    <h1 className="text-3xl font-bold">Connect AutoCAD · অটোক্যাড সংযোগ</h1>
    <p>AutoCAD-এ NBONLINECONNECT চালিয়ে আপনার কেনা license নির্বাচন করুন। Payment যাচাই হওয়ার পরে token পাঠানো হবে।</p>
    <ol className="list-decimal space-y-2 pl-6 text-sm">
      <li><a className="underline" href="/downloads/nb-online-connector-autocad2024.zip" download>Download the AutoCAD 2024 connector</a>.</li>
      <li>Close AutoCAD. Extract NBOnlineConnector.bundle into your Windows user folder: AppData/Roaming/Autodesk/ApplicationPlugins.</li>
      <li>Open AutoCAD with NB Engineering Tools installed, run NBONLINECONNECT, then confirm your purchased license here.</li>
    </ol>
    <form onSubmit={submit} className="space-y-4">
      <label className="block">Purchased license
        <select required name="license_code" className="mt-2 block w-full rounded border p-3">
          <option value="">Select a license</option>
          {licenses.map((license) => <option key={license.license_code} value={license.license_code}>{license.product_name} — {license.license_code}</option>)}
        </select>
      </label>
      <button disabled={busy || licenses.length === 0} className="rounded bg-navy px-5 py-3 text-white disabled:opacity-50">{busy ? 'Connecting…' : 'Confirm my computer'}</button>
    </form>
    <p role="status">{message}</p>
    <Link href="/login?next=/account" target="_blank" rel="noreferrer" className="underline">Sign in in another tab</Link>
    <button type="button" onClick={() => window.location.reload()} className="ml-4 underline">Refresh licenses after signing in</button>
    <p className="text-sm">An existing offline license with a different license ID needs support-assisted migration. Its balance will not be overwritten.</p>
  </section>;
}
