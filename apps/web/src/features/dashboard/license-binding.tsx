'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api/browser';

export function LicenseBinding() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setResult('');
    try {
      const response = await api<{ data: { license_code: string; email: string; already_bound: boolean } }>('/admin/licenses/bind-existing', {
        method: 'POST', body: {
          email: String(form.get('email')).trim(), license_code: String(form.get('license_code')).trim().toUpperCase(),
          reason: String(form.get('reason')).trim(), reference: String(form.get('reference')).trim(),
          ownership_verified: form.get('ownership_verified') === 'on',
        },
      });
      const value = response.data;
      setResult(`${value.license_code} ${value.already_bound ? 'is already linked' : 'has been linked'} to ${value.email}. ${value.already_bound ? 'No balance or status was changed.' : 'Online wallet starts at 0 tokens. Use Add Token for a reviewed credit.'} The customer can refresh Connect AutoCAD to select the license.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'License binding failed.'); }
    finally { setBusy(false); }
  }

  return <details className="rounded-lg border border-line bg-white p-5">
    <summary className="cursor-pointer text-lg font-semibold">Bind existing license / পুরোনো লাইসেন্স যুক্ত করুন</summary>
    <p className="my-3 text-sm text-muted">Verify the customer’s existing NB Engineering Tools license before importing it. Another account’s license cannot be transferred here. This does not approve a payment, move legacy tokens or reset a device.</p>
    <form onSubmit={submit} className="max-w-2xl space-y-3">
      <fieldset disabled={busy} className="space-y-3 disabled:opacity-50">
        <label className="block">Customer email<input required type="email" name="email" maxLength={255} className="mt-1 block w-full rounded border p-2" /></label>
        <label className="block">Existing license code<input required name="license_code" maxLength={63} placeholder="NB-202608-61FC41C2" className="mt-1 block w-full rounded border p-2" /></label>
        <label className="block">Support reference<input required name="reference" maxLength={200} placeholder="Support ticket or verified license record" className="mt-1 block w-full rounded border p-2" /></label>
        <label className="block">Binding reason<textarea required name="reason" minLength={10} maxLength={2000} className="mt-1 block w-full rounded border p-2" /></label>
        <label className="flex gap-2"><input required type="checkbox" name="ownership_verified" />I verified this customer owns this existing license.</label>
        <button className="rounded-lg bg-blue px-4 py-2 font-semibold text-white" type="submit">{busy ? 'Binding…' : 'Bind existing license'}</button>
      </fieldset>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {result && <p role="status" className="text-green-800">{result}</p>}
    </form>
  </details>;
}
