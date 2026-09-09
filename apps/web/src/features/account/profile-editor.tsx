'use client';

import Image from 'next/image';
import { useState } from 'react';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type ProfileUser = { id: number; name: string; phone: string | null; email: string; roles: string[]; status: string; email_verified: boolean; profile?: { has_photo?: boolean; display_name?: string | null; headline?: string | null; bio?: string | null; organization?: string | null; designation?: string | null; district?: string | null } };
export function ProfileEditor({ initial, admin = false, canEdit = true }: { initial: ProfileUser; admin?: boolean; canEdit?: boolean }) {
  const { locale } = useLocale(); const en = locale === 'en';
  const [user, setUser] = useState(initial); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [version, setVersion] = useState(0);
  const endpoint = admin ? `/admin/users/${user.id}` : '/me';
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); setBusy(true); setMessage('');
    try {
      const profile = Object.fromEntries(['display_name', 'headline', 'bio', 'organization', 'designation', 'district'].map(key => [key, values.get(key)]));
      const result = await api<{ data: ProfileUser }>(endpoint, { method: 'PATCH', body: { name: values.get('name'), phone: values.get('phone'), profile } });
      setUser(result.data); setMessage(en ? 'Profile saved.' : 'প্রোফাইল সংরক্ষণ হয়েছে।');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save'); }
    finally { setBusy(false); }
  }
  async function photo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setMessage('');
    try { const r = await api<{ data: ProfileUser }>('/me/avatar', { method: 'POST', body: new FormData(form) }); setUser(r.data); setVersion(v => v + 1); form.reset(); setMessage(en ? 'Photo uploaded.' : 'ছবি আপলোড হয়েছে।'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to upload'); }
    finally { setBusy(false); }
  }
  const fields = [{ key: 'display_name', label: en ? 'Display name' : 'প্রদর্শিত নাম', max: 120 }, { key: 'headline', label: en ? 'Headline' : 'পরিচিতি', max: 180 }, { key: 'organization', label: en ? 'Organization' : 'প্রতিষ্ঠান', max: 160 }, { key: 'designation', label: en ? 'Designation' : 'পদবি', max: 160 }, { key: 'district', label: en ? 'District' : 'জেলা', max: 80 }] as const;
  return <div className="space-y-6"><h1 className="text-3xl font-bold">{admin ? 'View / Edit user' : en ? 'My profile' : 'আমার প্রোফাইল'}</h1>
    <Card className="flex flex-wrap items-center gap-6 p-6">{user.profile?.has_photo ? <Image unoptimized src={`/api/v1${endpoint}/avatar?v=${version}`} width={120} height={120} alt={en ? 'Profile photo' : 'প্রোফাইল ছবি'} className="h-28 w-28 rounded-full object-cover" /> : <div className="flex h-28 w-28 items-center justify-center rounded-full bg-blue-soft text-3xl font-bold">{user.name.slice(0, 1)}</div>}<div><h2 className="text-xl font-bold">{user.name}</h2><p>{user.email}</p><p className="mt-2 text-sm">{user.roles.join(', ')} · {user.status} · {user.email_verified ? 'Email verified' : 'Email unverified'}</p></div></Card>
    {message && <p role="status" className="rounded border border-line p-4">{message}</p>}
    {!admin && <Card className="p-6"><form onSubmit={photo} className="space-y-3"><label className="block font-semibold">{en ? 'Profile photo' : 'প্রোফাইল ছবি'}<input type="file" name="photo" required accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full" /></label><p className="text-sm text-muted">JPG, PNG, WebP · {en ? 'Maximum 5 MB. Visible to you and authorized admins.' : 'সর্বোচ্চ 5 MB। আপনি ও অনুমোদিত admin দেখতে পারবেন।'}</p><Button type="submit" disabled={busy}>{en ? 'Upload photo' : 'ছবি আপলোড'}</Button></form></Card>}
    <Card className="p-6"><form onSubmit={save}><fieldset disabled={busy || !canEdit} className="grid gap-5 sm:grid-cols-2">
      <label>{en ? 'Name' : 'নাম'}<input name="name" required minLength={2} maxLength={120} defaultValue={user.name} className="mt-1 block w-full rounded border border-line p-3" /></label>
      <label>{en ? 'Mobile number (required)' : 'মোবাইল নম্বর (আবশ্যক)'}<input type="tel" name="phone" required pattern="[+]?[0-9]{7,15}" maxLength={16} defaultValue={user.phone || ''} className="mt-1 block w-full rounded border border-line p-3" /></label>
      {fields.map(f => <label key={f.key}>{f.label}<input name={f.key} maxLength={f.max} defaultValue={user.profile?.[f.key] || ''} className="mt-1 block w-full rounded border border-line p-3" /></label>)}
      <label className="sm:col-span-2">{en ? 'About / Bio' : 'নিজের সম্পর্কে'}<textarea name="bio" maxLength={2000} rows={4} defaultValue={user.profile?.bio || ''} className="mt-1 block w-full rounded border border-line p-3" /></label>
      {canEdit && <Button type="submit">{en ? 'Save profile' : 'প্রোফাইল সংরক্ষণ'}</Button>}
    </fieldset></form></Card>
  </div>;
}
