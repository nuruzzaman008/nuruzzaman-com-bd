'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { fileSize } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { slugify } from '@/lib/slug';
import { uploadInParts } from '@/lib/uploads/chunked-upload';

export type AdminRelease = {
  id: number;
  slug: string;
  name: string;
  version: string | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  original_filename?: string | null;
  is_available: boolean;
  variant_ids?: number[];
};

export type LicenceOption = { id: number; label: string };

/** The ceiling the owner set for an installer. */
export const MAX_INSTALLER_BYTES = 300 * 1024 * 1024;

function problem(caught: unknown, bn: boolean): string {
  if (caught instanceof ApiError) {
    const fields = (caught as { fields?: Record<string, string[]> }).fields ?? {};

    return [caught.message, ...Object.values(fields).flat()].join(' ');
  }

  return bn ? 'কাজটি করা যায়নি। আবার চেষ্টা করুন।' : 'That did not work. Please try again.';
}

/**
 * Software installers buyers download after paying - one release per AutoCAD
 * version, say - managed from the dashboard: create a release, upload its
 * file in parts, choose which licences give it, and switch its download on.
 *
 * Installers never go through the Media library: they live on the private
 * disk and are only ever handed to someone whose order entitles them.
 */
export function ReleasesManager({
  releases,
  licences,
}: {
  releases: AdminRelease[];
  licences: LicenceOption[];
}) {
  const { locale } = useLocale();
  const bn = locale === 'bn';

  return (
    <div className="space-y-6">
      <NewRelease bn={bn} licences={licences} />

      {releases.length ? (
        releases.map((release) => (
          <ReleaseCard key={release.id} release={release} licences={licences} bn={bn} />
        ))
      ) : (
        <p className="text-muted">{bn ? 'এখনো কোনো release নেই।' : 'No releases yet.'}</p>
      )}
    </div>
  );
}

function NewRelease({ bn, licences }: { bn: boolean; licences: LicenceOption[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTyped, setSlugTyped] = useState(false);
  const [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const created = await api<{ data: AdminRelease }>('/admin/download-assets', {
        method: 'POST',
        body: { name: name.trim(), slug: slugify(slug || name), version: version.trim() || null },
      });

      // Every licence gives every installer, as the owner decided; the ticks
      // on the release can narrow that afterwards.
      if (licences.length) {
        await api(`/admin/download-assets/${created.data.id}/variants`, {
          method: 'PUT',
          body: { variant_ids: licences.map((licence) => licence.id) },
        });
      }

      setName('');
      setSlug('');
      setSlugTyped(false);
      setVersion('');
      setNotice(
        bn
          ? 'Release তৈরি হয়েছে — এবার নিচে তার installer ফাইল upload করুন।'
          : 'Release created - now upload its installer below.',
      );
      router.refresh();
    } catch (caught) {
      setError(problem(caught, bn));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl font-bold text-navy">{bn ? 'নতুন release' : 'New release'}</h2>
      <p className="mt-1 text-sm text-muted">
        {bn
          ? 'প্রতিটি AutoCAD version-এর installer-এর জন্য একটি করে release তৈরি করুন, যেমন "NB Engineering Tools — AutoCAD 2025"।'
          : 'Create one release for each AutoCAD version’s installer, such as "NB Engineering Tools — AutoCAD 2025".'}
      </p>
      <form
        onSubmit={create}
        className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end"
      >
        <label className="text-sm font-medium text-navy">
          {bn ? 'নাম' : 'Name'}
          <Input
            required
            maxLength={200}
            value={name}
            disabled={busy}
            placeholder="NB Engineering Tools — AutoCAD 2025"
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTyped) setSlug(slugify(event.target.value));
            }}
            className="mt-1"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          URL slug
          <Input
            required
            maxLength={120}
            value={slug}
            disabled={busy}
            placeholder="nb-engineering-tools-autocad-2025"
            onChange={(event) => {
              setSlug(event.target.value);
              setSlugTyped(true);
            }}
            onBlur={() => setSlug(slugify(slug))}
            className="font-latin mt-1"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          {bn ? 'ভার্সন' : 'Version'}
          <Input
            maxLength={40}
            value={version}
            disabled={busy}
            placeholder="6.0"
            onChange={(event) => setVersion(event.target.value)}
            className="font-latin mt-1"
          />
        </label>
        <Button type="submit" disabled={busy || !name.trim()}>
          {bn ? 'Release তৈরি করুন' : 'Create release'}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-2 text-sm text-success">
          {notice}
        </p>
      ) : null}
    </Card>
  );
}

function ReleaseCard({
  release,
  licences,
  bn,
}: {
  release: AdminRelease;
  licences: LicenceOption[];
  bn: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(release.name);
  const [version, setVersion] = useState(release.version ?? '');
  const [chosen, setChosen] = useState<number[]>(release.variant_ids ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hasFile = Boolean(release.size_bytes);
  const base = `/admin/download-assets/${release.id}`;

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await work();
      setNotice(done);
      router.refresh();
    } catch (caught) {
      setError(problem(caught, bn));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function upload() {
    if (!file) {
      return;
    }

    if (file.size > MAX_INSTALLER_BYTES) {
      setNotice(null);
      setError(bn ? 'Installer সর্বোচ্চ 300 MB হতে পারে।' : 'An installer can be up to 300 MB.');

      return;
    }

    if (!/\.(exe|msi|zip)$/i.test(file.name)) {
      setNotice(null);
      setError(bn ? '.exe, .msi বা .zip ফাইল দিন।' : 'Choose an .exe, .msi or .zip file.');

      return;
    }

    void run(
      async () => {
        // Sent in 1 MB parts: the host refuses any single upload over 2 MB.
        const parts = await uploadInParts(file, (fraction) => setProgress(fraction));
        await api(`${base}/file`, { method: 'POST', body: parts });
        setFile(null);
      },
      bn ? 'Installer upload হয়েছে।' : 'Installer uploaded.',
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      {/* Card renders only its own props, so the release is named on a wrapper. */}
      <div data-release={release.slug}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-navy" data-authored="true">
              {release.name}
            </h3>
            <p className="font-latin text-xs text-muted">
              {release.version ? `v${release.version} · ` : ''}/{release.slug}
            </p>
          </div>
          <Badge tone={release.is_available ? 'success' : 'neutral'}>
            {release.is_available
              ? bn
                ? 'Download চালু'
                : 'Download on'
              : bn
                ? 'Download বন্ধ'
                : 'Download off'}
          </Badge>
        </div>

        <div className="mt-4 rounded-lg bg-surface p-4 text-sm">
          {hasFile ? (
            <dl className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <dt className="text-muted">{bn ? 'ফাইল' : 'File'}</dt>
              <dd className="font-latin text-navy">
                {release.original_filename ?? '—'} · {fileSize(release.size_bytes)}
              </dd>
              <dt className="text-muted">SHA-256</dt>
              <dd className="font-latin text-xs break-all text-navy">{release.checksum_sha256}</dd>
            </dl>
          ) : (
            <p className="text-muted">
              {bn ? 'এখনো installer upload করা হয়নি।' : 'No installer uploaded yet.'}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-navy">
              <span className="sr-only">
                {bn ? `${release.name}-এর installer ফাইল` : `Installer file for ${release.name}`}
              </span>
              <input
                type="file"
                accept=".exe,.msi,.zip"
                disabled={busy}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="block text-sm"
              />
            </label>
            <Button type="button" size="sm" disabled={busy || !file} onClick={upload}>
              {hasFile
                ? bn
                  ? 'নতুন ফাইল দিয়ে বদলান'
                  : 'Replace file'
                : bn
                  ? 'Installer upload করুন'
                  : 'Upload installer'}
            </Button>
          </div>
          {progress !== null ? (
            <div className="mt-3" role="status">
              <p className="text-xs text-navy">
                {bn ? 'Upload হচ্ছে' : 'Uploading'} — {Math.round(progress * 100)}%
              </p>
              <span
                aria-hidden="true"
                className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white"
              >
                <span
                  className="block h-full bg-blue"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </span>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            {bn
              ? '.exe, .msi বা .zip · সর্বোচ্চ 300 MB · নতুন ফাইল দিলে পুরোনোটি মুছে যায়।'
              : '.exe, .msi or .zip · up to 300 MB · a new file replaces the old one.'}
          </p>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-navy">
            {bn ? 'কোন licence কিনলে এই installer পাবে' : 'Licences that give this installer'}
          </legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {licences.map((licence) => (
              <label key={licence.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.includes(licence.id)}
                  disabled={busy}
                  onChange={(event) =>
                    setChosen((current) =>
                      event.target.checked
                        ? [...current, licence.id]
                        : current.filter((id) => id !== licence.id),
                    )
                  }
                />
                {licence.label}
              </label>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => api(`${base}/variants`, { method: 'PUT', body: { variant_ids: chosen } }),
                  bn ? 'Licence তালিকা সংরক্ষিত হয়েছে।' : 'Licences saved.',
                )
              }
            >
              {bn ? 'Licence সংরক্ষণ' : 'Save licences'}
            </Button>
            <p className="text-xs text-muted">
              {bn
                ? 'এখান থেকে বদলালে সেটা নতুন order থেকে কার্যকর হয়।'
                : 'A change here applies to new orders.'}
            </p>
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <label className="text-sm font-medium text-navy">
            {bn ? 'নাম' : 'Name'}
            <Input
              maxLength={200}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-72 max-w-full"
            />
          </label>
          <label className="text-sm font-medium text-navy">
            {bn ? 'ভার্সন' : 'Version'}
            <Input
              maxLength={40}
              value={version}
              disabled={busy}
              onChange={(event) => setVersion(event.target.value)}
              className="font-latin mt-1 w-28"
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || !name.trim()}
            onClick={() =>
              void run(
                () =>
                  api(base, {
                    method: 'PATCH',
                    body: { name: name.trim(), version: version.trim() || null },
                  }),
                bn ? 'সংরক্ষিত হয়েছে।' : 'Saved.',
              )
            }
          >
            {bn ? 'নাম ও ভার্সন সংরক্ষণ' : 'Save name and version'}
          </Button>
          <Button
            type="button"
            size="sm"
            className="ms-auto"
            disabled={busy || (!hasFile && !release.is_available)}
            onClick={() =>
              void run(
                () => api(base, { method: 'PATCH', body: { is_available: !release.is_available } }),
                release.is_available
                  ? bn
                    ? 'Download বন্ধ করা হয়েছে।'
                    : 'Download switched off.'
                  : bn
                    ? 'Download চালু হয়েছে।'
                    : 'Download switched on.',
              )
            }
          >
            {release.is_available
              ? bn
                ? 'Download বন্ধ করুন'
                : 'Switch download off'
              : bn
                ? 'Download চালু করুন'
                : 'Switch download on'}
          </Button>
        </div>
        {!hasFile ? (
          <p className="mt-2 text-xs text-muted">
            {bn
              ? 'Installer upload করার পরে download চালু করা যাবে।'
              : 'The download can be switched on once an installer is uploaded.'}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 text-sm text-success">
            {notice}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
