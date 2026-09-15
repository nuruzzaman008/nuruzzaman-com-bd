'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Field, Input, Textarea } from '@/components/ui/form';
import {
  mediaHref,
  mediaTitle,
  monthLabel,
  type MediaFilters,
} from '@/features/dashboard/media-filters';
import { ApiError, api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { date, fileSize } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';

type Notice = { tone: 'success' | 'danger'; text: string };

const control =
  'h-10 rounded-md border border-line bg-white px-3 text-sm text-navy focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue';

function isImage(item: MediaItem): boolean {
  return Boolean(item.url) && item.mime_type.startsWith('image/');
}

/** The picture inside a tile or a row; a document shows its kind instead. */
function Thumb({ item, sizes }: { item: MediaItem; sizes: string }) {
  if (isImage(item) && item.url) {
    return (
      <Image
        src={item.url}
        alt=""
        fill
        sizes={sizes}
        unoptimized={item.mime_type === 'image/svg+xml'}
        className="object-cover"
      />
    );
  }

  const kind =
    item.mime_type === 'application/pdf'
      ? 'PDF'
      : (item.original_name.split('.').pop() ?? '').toUpperCase();

  return (
    <span className="font-latin absolute inset-0 grid place-items-center bg-surface text-sm font-bold text-muted">
      {kind}
    </span>
  );
}

function GridIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="3" width="6" height="6" />
      <rect x="11" y="3" width="6" height="6" />
      <rect x="3" y="11" width="6" height="6" />
      <rect x="11" y="11" width="6" height="6" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 4h14M3 8h14M3 12h14M3 16h14" />
    </svg>
  );
}

/**
 * The media library, laid out like a WordPress library: a toolbar of view,
 * type and date filters with bulk select and a search box, then a dense grid
 * of square thumbnails titled along the bottom. A tile opens the file's
 * details - alt text, caption, address, delete.
 *
 * Filters live in the address (see media-filters.ts); the server page reads
 * them, so paging, reloading and the back button all keep them.
 */
export function MediaLibrary({
  items,
  months,
  filters,
  page,
}: {
  items: MediaItem[];
  months: string[];
  filters: MediaFilters;
  page: { current: number; last: number; total: number };
}) {
  const { locale, t } = useLocale();
  const bn = locale === 'bn';
  const router = useRouter();
  const [search, setSearch] = useState(filters.q ?? '');
  const [bulk, setBulk] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const view = filters.view ?? 'grid';

  // Searches as the admin types, a moment after they stop.
  useEffect(() => {
    const term = search.trim();

    if (term === (filters.q ?? '')) {
      return;
    }

    const timer = window.setTimeout(
      () => router.push(mediaHref({ ...filters, q: term || undefined })),
      500,
    );

    return () => window.clearTimeout(timer);
  }, [search, filters, router]);

  function go(changes: Partial<MediaFilters>) {
    router.push(mediaHref({ ...filters, ...changes }));
  }

  function toggle(id: number) {
    setSelected((previous) => {
      const next = new Set(previous);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function endBulk() {
    setBulk(false);
    setSelected(new Set());
  }

  /**
   * Deletes the files one by one. Any the API refuses because they are still
   * in use are listed together, and deleted only if the admin says so again.
   */
  async function deleteFiles(files: MediaItem[]): Promise<boolean> {
    const inUse: { item: MediaItem; message: string }[] = [];
    const failed: string[] = [];
    let deleted = 0;

    setBusy(true);
    setNotice(null);

    try {
      for (const item of files) {
        try {
          await api(`/admin/media/${item.id}`, { method: 'DELETE' });
          deleted += 1;
        } catch (caught) {
          if (caught instanceof ApiError && caught.status === 409) {
            inUse.push({ item, message: caught.message });
          } else {
            failed.push(`${item.original_name}: ${caught instanceof Error ? caught.message : ''}`);
          }
        }
      }

      if (inUse.length > 0) {
        const list = inUse
          .map(({ item, message }) => `• ${item.original_name} — ${message}`)
          .join('\n');

        const anyway = window.confirm(
          bn
            ? `এই ফাইলগুলো এখনো ব্যবহার হচ্ছে:\n${list}\n\nমুছলে ওই জায়গাগুলোতে এগুলো আর দেখা যাবে না। তবুও মুছবেন?`
            : `These files are still in use:\n${list}\n\nThose places will lose them. Delete anyway?`,
        );

        if (anyway) {
          for (const { item } of inUse) {
            try {
              await api(`/admin/media/${item.id}`, { method: 'DELETE', query: { force: 1 } });
              deleted += 1;
            } catch (caught) {
              failed.push(
                `${item.original_name}: ${caught instanceof Error ? caught.message : ''}`,
              );
            }
          }
        }
      }

      if (failed.length > 0) {
        setNotice({
          tone: 'danger',
          text: `${bn ? 'কিছু ফাইল মুছে ফেলা যায়নি' : 'Some files could not be deleted'}: ${failed.join('; ')}`,
        });
      } else if (deleted > 0) {
        setNotice({
          tone: 'success',
          text: bn
            ? `${deleted}টি ফাইল মুছে ফেলা হয়েছে।`
            : `${deleted} ${deleted === 1 ? 'file' : 'files'} deleted.`,
        });
      }

      if (deleted > 0) {
        router.refresh();
      }

      return deleted === files.length;
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    const files = items.filter((item) => selected.has(item.id));

    if (files.length === 0) {
      return;
    }

    const question = bn
      ? `${files.length}টি ফাইল স্থায়ীভাবে মুছে ফেলবেন?`
      : `Delete ${files.length} ${files.length === 1 ? 'file' : 'files'} permanently?`;

    if (!window.confirm(question)) {
      return;
    }

    await deleteFiles(files);
    endBulk();
  }

  const filtered = Boolean(filters.q || filters.type || filters.month);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3 rounded-[--radius-card] border border-line bg-white p-4 shadow-[--shadow-card]">
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={bn ? 'দেখানোর ধরন' : 'View'}
        >
          <button
            type="button"
            aria-label={bn ? 'তালিকা আকারে' : 'List view'}
            aria-pressed={view === 'list'}
            onClick={() => go({ view: 'list' })}
            className={cn(
              'rounded p-1.5',
              view === 'list' ? 'text-navy' : 'text-muted hover:text-navy',
            )}
          >
            <ListIcon />
          </button>
          <button
            type="button"
            aria-label={bn ? 'গ্রিড আকারে' : 'Grid view'}
            aria-pressed={view === 'grid'}
            onClick={() => go({ view: 'grid' })}
            className={cn(
              'rounded p-1.5',
              view === 'grid' ? 'text-navy' : 'text-muted hover:text-navy',
            )}
          >
            <GridIcon />
          </button>
        </div>

        <select
          aria-label={bn ? 'ধরন অনুযায়ী' : 'Filter by type'}
          value={filters.type ?? ''}
          onChange={(event) =>
            go({ type: (event.target.value || undefined) as MediaFilters['type'] })
          }
          className={control}
        >
          <option value="">{bn ? 'সব মিডিয়া' : 'All media items'}</option>
          <option value="image">{bn ? 'ছবি' : 'Images'}</option>
          <option value="pdf">{bn ? 'PDF ডকুমেন্ট' : 'PDF documents'}</option>
        </select>

        <select
          aria-label={bn ? 'তারিখ অনুযায়ী' : 'Filter by date'}
          value={filters.month ?? ''}
          onChange={(event) => go({ month: event.target.value || undefined })}
          className={control}
        >
          <option value="">{bn ? 'সব তারিখ' : 'All dates'}</option>
          {months.map((month) => (
            <option key={month} value={month}>
              {monthLabel(month, bn)}
            </option>
          ))}
        </select>

        {bulk ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={busy || selected.size === 0}
              onClick={() => void deleteSelected()}
            >
              {bn ? 'স্থায়ীভাবে মুছুন' : 'Delete permanently'}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={endBulk}>
              {bn ? 'বাতিল' : 'Cancel'}
            </Button>
            <span role="status" className="text-sm text-muted">
              {bn ? `${selected.size}টি বাছাই করা হয়েছে` : `${selected.size} selected`}
            </span>
          </>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => setBulk(true)}>
            {bn ? 'একসাথে বাছাই' : 'Bulk select'}
          </Button>
        )}

        <form
          role="search"
          className="flex w-full items-center gap-2 sm:ms-auto sm:w-auto"
          onSubmit={(event) => {
            event.preventDefault();
            go({ q: search.trim() || undefined });
          }}
        >
          <label htmlFor="media-search" className="shrink-0 text-sm text-muted">
            {bn ? 'মিডিয়া খুঁজুন' : 'Search media'}
          </label>
          <input
            id="media-search"
            type="search"
            value={search}
            maxLength={120}
            onChange={(event) => setSearch(event.target.value)}
            className={cn(control, 'min-w-0 flex-1 sm:w-60')}
          />
        </form>
      </div>

      {notice ? (
        <Callout
          className="mt-4"
          tone={notice.tone}
          role={notice.tone === 'danger' ? 'alert' : 'status'}
        >
          {notice.text}
        </Callout>
      ) : null}

      <p className="mt-3 text-sm text-muted">
        {bn ? `${page.total}টি ফাইল` : `${page.total} ${page.total === 1 ? 'item' : 'items'}`}
      </p>

      {items.length === 0 ? (
        <p className="mt-6 rounded-[--radius-card] border border-dashed border-line bg-white p-8 text-center text-muted">
          {filtered
            ? bn
              ? 'এই filter-এ কোনো ফাইল মেলেনি।'
              : 'No media matches these filters.'
            : t.admin.media.empty}
        </p>
      ) : view === 'grid' ? (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {items.map((item) => {
            const title = mediaTitle(item);
            const chosen = bulk && selected.has(item.id);

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => (bulk ? toggle(item.id) : setOpen(item))}
                  aria-pressed={bulk ? chosen : undefined}
                  aria-label={`${bulk ? (bn ? 'বাছাই' : 'Select') : bn ? 'বিস্তারিত' : 'Details'}: ${title}`}
                  className={cn(
                    'relative block aspect-square w-full overflow-hidden border bg-surface text-start',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue',
                    chosen ? 'border-blue ring-2 ring-blue' : 'border-line hover:border-blue',
                  )}
                >
                  <Thumb
                    item={item}
                    sizes="(min-width: 1280px) 12vw, (min-width: 1024px) 16vw, (min-width: 640px) 30vw, 45vw"
                  />

                  {isImage(item) && !item.alt_text ? (
                    <span className="absolute start-1.5 top-1.5 rounded bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {bn ? 'Alt নেই' : 'No alt'}
                    </span>
                  ) : null}

                  {bulk ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-sm border-2 text-xs font-bold',
                        chosen
                          ? 'border-blue bg-blue text-white'
                          : 'border-white bg-white/80 text-transparent',
                      )}
                    >
                      ✓
                    </span>
                  ) : null}

                  <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-white/85 px-2 py-1.5 text-xs leading-snug font-medium text-navy">
                    {title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-[--radius-card] border border-line bg-white">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                {bulk ? (
                  <th className="w-10 px-3 py-2">
                    <span className="sr-only">{bn ? 'বাছাই' : 'Select'}</span>
                  </th>
                ) : null}
                <th className="px-3 py-2 text-start font-medium">{bn ? 'ফাইল' : 'File'}</th>
                <th className="px-3 py-2 text-start font-medium">Alt</th>
                <th className="px-3 py-2 text-start font-medium">{bn ? 'ধরন' : 'Type'}</th>
                <th className="px-3 py-2 text-end font-medium">{bn ? 'আকার' : 'Size'}</th>
                <th className="px-3 py-2 text-start font-medium">{bn ? 'আপলোড' : 'Uploaded'}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const title = mediaTitle(item);

                return (
                  <tr key={item.id} className="border-b border-line align-middle last:border-0">
                    {bulk ? (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggle(item.id)}
                          aria-label={`${bn ? 'বাছাই' : 'Select'}: ${title}`}
                          className="size-4"
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="relative block size-14 shrink-0 overflow-hidden border border-line bg-surface">
                          <Thumb item={item} sizes="56px" />
                        </span>
                        <span className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setOpen(item)}
                            aria-label={`${bn ? 'বিস্তারিত' : 'Details'}: ${title}`}
                            className="block max-w-72 truncate text-start font-semibold text-blue hover:underline"
                          >
                            {title}
                          </button>
                          <span className="font-latin block max-w-72 truncate text-xs text-muted">
                            {item.original_name}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {item.alt_text ? (
                        <span className="text-muted">{item.alt_text}</span>
                      ) : (
                        <span className="text-xs font-medium text-danger">
                          {t.admin.media.noAlt}
                        </span>
                      )}
                    </td>
                    <td className="font-latin px-3 py-2 text-muted">{item.mime_type}</td>
                    <td className="font-latin px-3 py-2 text-end whitespace-nowrap text-muted">
                      {fileSize(item.size_bytes)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">
                      {date(item.uploaded_at, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {page.last > 1 ? (
        <nav aria-label={bn ? 'পাতা' : 'Pages'} className="mt-6 flex items-center gap-4 text-sm">
          {page.current > 1 ? (
            <Link href={mediaHref(filters, page.current - 1)} className="text-blue hover:underline">
              {bn ? '← আগের পাতা' : '← Previous'}
            </Link>
          ) : null}
          <span className="text-muted">
            {page.current} / {page.last}
          </span>
          {page.current < page.last ? (
            <Link href={mediaHref(filters, page.current + 1)} className="text-blue hover:underline">
              {bn ? 'পরের পাতা →' : 'Next →'}
            </Link>
          ) : null}
        </nav>
      ) : null}

      {open ? (
        <MediaDetails
          key={open.id}
          item={open}
          busy={busy}
          onClose={() => setOpen(null)}
          onSaved={(updated) => {
            setOpen(updated);
            router.refresh();
          }}
          onDelete={async () => {
            const question = bn
              ? `“${open.original_name}” ফাইলটি স্থায়ীভাবে মুছে ফেলবেন?`
              : `Delete “${open.original_name}” permanently?`;

            if (window.confirm(question) && (await deleteFiles([open]))) {
              setOpen(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

/** One file's details: a larger preview, its facts, alt text and caption, delete. */
function MediaDetails({
  item,
  busy,
  onClose,
  onSaved,
  onDelete,
}: {
  item: MediaItem;
  busy: boolean;
  onClose: () => void;
  onSaved: (item: MediaItem) => void;
  onDelete: () => Promise<void>;
}) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const closeRef = useRef<HTMLButtonElement>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<Notice | null>(null);

  useEffect(() => {
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setSaving(true);
    setMessage(null);

    try {
      const response = await api<{ data: MediaItem }>(`/admin/media/${item.id}`, {
        method: 'PATCH',
        body: {
          alt_text: String(form.get('alt_text') ?? '').trim() || null,
          caption: String(form.get('caption') ?? '').trim() || null,
        },
      });

      onSaved(response.data);
      setMessage({ tone: 'success', text: bn ? 'সংরক্ষণ হয়েছে।' : 'Saved.' });
    } catch (caught) {
      setMessage({
        tone: 'danger',
        text:
          caught instanceof Error && caught.message
            ? caught.message
            : bn
              ? 'সংরক্ষণ করা যায়নি।'
              : 'Could not save.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!item.url) return;

    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const facts = [
    { label: bn ? 'ফাইল' : 'File', value: item.original_name, latin: true },
    { label: bn ? 'ধরন' : 'Type', value: item.mime_type, latin: true },
    { label: bn ? 'আকার' : 'Size', value: fileSize(item.size_bytes) ?? '—', latin: true },
    ...(item.width && item.height
      ? [{ label: bn ? 'মাপ' : 'Dimensions', value: `${item.width} × ${item.height}`, latin: true }]
      : []),
    {
      label: bn ? 'আপলোড' : 'Uploaded',
      value: date(item.uploaded_at, locale) ?? '—',
      latin: false,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-details-title"
        className="grid max-h-[90dvh] w-full max-w-5xl overflow-hidden rounded-[--radius-card] bg-white shadow-[--shadow-raised] md:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div className="relative flex min-h-60 items-center justify-center bg-surface p-4">
          {isImage(item) && item.url ? (
            <Image
              src={item.url}
              alt={item.alt_text ?? ''}
              width={item.width ?? 1200}
              height={item.height ?? 900}
              sizes="(min-width: 768px) 60vw, 100vw"
              unoptimized={item.mime_type === 'image/svg+xml'}
              className="max-h-[80dvh] w-auto object-contain"
            />
          ) : (
            <span className="font-latin text-2xl font-bold text-muted">
              {item.mime_type === 'application/pdf' ? 'PDF' : item.mime_type}
            </span>
          )}
        </div>

        <div className="overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id="media-details-title" className="text-lg font-bold text-navy">
              {bn ? 'ফাইলের বিস্তারিত' : 'Attachment details'}
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={bn ? 'বন্ধ করুন' : 'Close'}
              className="rounded px-2 text-xl leading-none text-muted hover:bg-surface hover:text-navy"
            >
              ×
            </button>
          </div>

          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {facts.map((fact) => (
              <div key={fact.label} className="contents">
                <dt className="text-muted">{fact.label}</dt>
                <dd className={cn('min-w-0 break-all text-navy', fact.latin && 'font-latin')}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>

          <form onSubmit={save} className="mt-5 space-y-3">
            <Field
              label={bn ? 'Alt টেক্সট' : 'Alt text'}
              hint={
                bn
                  ? 'ছবিতে কী আছে, যারা দেখতে পান না তাদের জন্য লিখুন।'
                  : 'Describe the image for people who cannot see it.'
              }
            >
              {(props) => (
                <Input
                  name="alt_text"
                  defaultValue={item.alt_text ?? ''}
                  maxLength={255}
                  {...props}
                />
              )}
            </Field>
            <Field label={bn ? 'ক্যাপশন' : 'Caption'}>
              {(props) => (
                <Textarea
                  name="caption"
                  rows={2}
                  defaultValue={item.caption ?? ''}
                  maxLength={512}
                  {...props}
                />
              )}
            </Field>
            {message ? (
              <Callout tone={message.tone} role={message.tone === 'danger' ? 'alert' : 'status'}>
                {message.text}
              </Callout>
            ) : null}
            <Button type="submit" size="sm" disabled={saving}>
              {bn ? 'সংরক্ষণ' : 'Save'}
            </Button>
          </form>

          {item.url ? (
            <div className="mt-5">
              <label htmlFor="media-details-url" className="text-sm text-muted">
                {bn ? 'ফাইলের URL' : 'File URL'}
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="media-details-url"
                  readOnly
                  value={item.url}
                  onFocus={(event) => event.currentTarget.select()}
                  className={cn(control, 'font-latin min-w-0 flex-1 text-xs')}
                />
                <Button type="button" size="sm" variant="secondary" onClick={() => void copy()}>
                  {copied ? (bn ? 'কপি হয়েছে ✓' : 'Copied ✓') : bn ? 'কপি' : 'Copy'}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-6 border-t border-line pt-4">
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() => void onDelete()}
            >
              {bn ? 'স্থায়ীভাবে মুছুন' : 'Delete permanently'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
