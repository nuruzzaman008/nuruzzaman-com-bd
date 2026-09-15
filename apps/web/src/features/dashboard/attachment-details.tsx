'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '@nuruzzaman/contracts';

import { ImageEditor } from '@/features/dashboard/image-editor';
import { deleteMediaFiles } from '@/features/dashboard/media-delete';
import {
  isImage,
  isVideo,
  lengthLabel,
  mediaTitle,
  type MediaDetail,
} from '@/features/dashboard/media-filters';
import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { date, fileSize } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';

type TextField = 'title' | 'alt_text' | 'caption' | 'description';

type Status = { tone: 'saving' | 'saved' | 'error'; text: string };

const input =
  'block w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-navy focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue';

/** Written by W3C for exactly this question. */
const ALT_GUIDE = 'https://www.w3.org/WAI/tutorials/images/decision-tree/';

/**
 * WordPress's "Attachment details": the file on the left - playable, or
 * editable if it is an image - and on the right its facts, where it is used,
 * its alt text, title, caption and description, its address, whether its
 * attachment page is in the sitemap, and the links to view, edit, download or
 * delete it.
 *
 * Text saves when the admin leaves a field, as WordPress does, so nothing
 * typed is lost by moving to the next file.
 */
export function AttachmentDetails({
  item,
  mode = 'dialog',
  onClose,
  onPrev,
  onNext,
  onChanged,
  onDelete,
}: {
  item: MediaItem | MediaDetail;
  mode?: 'dialog' | 'page';
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onChanged: (item: MediaItem) => void;
  onDelete: () => Promise<void>;
}) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const [current, setCurrent] = useState<MediaItem | MediaDetail>(item);
  const [detail, setDetail] = useState<MediaDetail | null>('used_in' in item ? item : null);
  const [status, setStatus] = useState<Status | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const altRef = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const handlers = useRef({ onClose, onPrev, onNext });

  const id = item.id;
  const hasDetail = 'used_in' in item;

  useEffect(() => {
    handlers.current = { onClose, onPrev, onNext };
  });

  // Where the file is used, and those places' focus keywords.
  useEffect(() => {
    if (hasDetail) return;

    let active = true;

    void api<{ data: MediaDetail }>(`/admin/media/${id}`)
      .then((response) => {
        if (active) {
          setDetail(response.data);
          setCurrent(response.data);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [id, hasDetail]);

  useEffect(() => {
    if (mode !== 'dialog') return;

    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

      if (event.key === 'Escape') handlers.current.onClose?.();
      else if (!typing && event.key === 'ArrowLeft') handlers.current.onPrev?.();
      else if (!typing && event.key === 'ArrowRight') handlers.current.onNext?.();
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  async function save(changes: Partial<Pick<MediaItem, TextField | 'exclude_from_sitemap'>>) {
    setStatus({ tone: 'saving', text: bn ? 'সংরক্ষণ হচ্ছে…' : 'Saving…' });

    try {
      const response = await api<{ data: MediaItem }>(`/admin/media/${id}`, {
        method: 'PATCH',
        body: changes,
      });

      setCurrent((previous) => ({ ...previous, ...response.data }));
      setDetail((previous) => (previous ? { ...previous, ...response.data } : previous));
      onChanged(response.data);
      setStatus({ tone: 'saved', text: bn ? 'সংরক্ষণ হয়েছে' : 'Saved' });
    } catch (caught) {
      setStatus({
        tone: 'error',
        text:
          caught instanceof Error && caught.message
            ? caught.message
            : bn
              ? 'সংরক্ষণ করা যায়নি।'
              : 'Could not save.',
      });
    }
  }

  function saveOnBlur(field: TextField) {
    return (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.currentTarget.value.trim() || null;

      if (value !== (current[field] ?? null)) {
        void save({ [field]: value } as Partial<Pick<MediaItem, TextField>>);
      }
    };
  }

  function applyKeyword(keyword: string) {
    if (altRef.current) {
      altRef.current.value = keyword;
    }

    void save({ alt_text: keyword });
  }

  async function copy() {
    if (!current.url) return;

    try {
      await navigator.clipboard.writeText(current.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function remove() {
    setDeleting(true);

    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const image = isImage(current);
  const video = isVideo(current);
  const keywords = detail?.focus_keywords ?? [];
  const usedIn = detail?.used_in ?? [];
  const title = mediaTitle(current);
  const heading = bn ? 'ফাইলের বিস্তারিত' : 'Attachment details';

  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: bn ? 'আপলোডের তারিখ' : 'Uploaded on',
      value: date(current.uploaded_at, locale) ?? '—',
    },
    ...(current.uploaded_by
      ? [{ label: bn ? 'আপলোড করেছেন' : 'Uploaded by', value: current.uploaded_by.name }]
      : []),
    ...(usedIn.length > 0
      ? [
          {
            label: bn ? 'ব্যবহার হয়েছে' : 'Uploaded to',
            value: usedIn.map((use, index) => (
              <span key={`${use.label}-${use.title}`}>
                {index > 0 ? ', ' : ''}
                {use.edit_path ? (
                  <Link href={use.edit_path} className="text-blue underline hover:text-navy">
                    {use.title}
                  </Link>
                ) : (
                  use.title
                )}
              </span>
            )),
          },
        ]
      : []),
    {
      label: bn ? 'ফাইলের নাম' : 'File name',
      value: <span className="font-latin break-all">{current.original_name}</span>,
    },
    {
      label: bn ? 'ফাইলের ধরন' : 'File type',
      value: <span className="font-latin">{current.mime_type}</span>,
    },
    {
      label: bn ? 'ফাইলের আকার' : 'File size',
      value: <span className="font-latin">{fileSize(current.size_bytes) ?? '—'}</span>,
    },
    ...(current.width && current.height
      ? [
          {
            label: bn ? 'মাপ' : 'Dimensions',
            value: bn
              ? `${current.width} × ${current.height} পিক্সেল`
              : `${current.width} by ${current.height} pixels`,
          },
        ]
      : []),
    ...(video && current.duration_seconds
      ? [{ label: bn ? 'দৈর্ঘ্য' : 'Length', value: lengthLabel(current.duration_seconds, bn) }]
      : []),
  ];

  const preview = editing ? (
    <ImageEditor
      item={current}
      onCancel={() => setEditing(false)}
      onSaved={(saved) => {
        setCurrent(saved);
        setDetail(saved);
        setEditing(false);
        onChanged(saved);
        setStatus({ tone: 'saved', text: bn ? 'ছবি সংরক্ষণ হয়েছে' : 'Image saved' });
      }}
    />
  ) : (
    <div className="flex w-full flex-col items-center gap-4">
      {image && current.url ? (
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt_text ?? ''}
          width={current.width ?? 1200}
          height={current.height ?? 900}
          sizes="(min-width: 768px) 60vw, 100vw"
          unoptimized={current.mime_type === 'image/svg+xml'}
          className="max-h-[70dvh] w-auto object-contain"
        />
      ) : video && current.url ? (
        <video
          controls
          preload="metadata"
          src={current.url}
          className="max-h-[70dvh] w-full bg-black"
        />
      ) : current.mime_type === 'application/pdf' && current.url ? (
        <iframe
          src={current.url}
          title={title}
          className="h-[70dvh] w-full rounded border border-line bg-white"
        />
      ) : (
        <span className="font-latin py-20 text-2xl font-bold text-muted">{current.mime_type}</span>
      )}

      {current.editable ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-10 rounded-md border border-blue bg-white px-4 text-sm font-semibold text-blue hover:bg-blue-soft"
        >
          {bn ? 'ছবি সম্পাদনা' : 'Edit Image'}
        </button>
      ) : null}
    </div>
  );

  const row = 'grid items-start gap-x-3 gap-y-1 sm:grid-cols-[8.5rem_minmax(0,1fr)]';
  const rowLabel = 'pt-2 text-sm text-muted sm:text-end';

  const sidebar = (
    <div className="space-y-5 text-sm">
      <dl className="space-y-1">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="inline font-semibold text-navy">{fact.label}: </dt>
            <dd className="inline text-muted">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div key={`fields-${current.id}`} className="space-y-3 border-t border-line pt-5">
        {image ? (
          <div className={row}>
            <label htmlFor={`media-${id}-alt`} className={rowLabel}>
              {bn ? 'Alt টেক্সট' : 'Alternative Text'}
            </label>
            <div className="space-y-2">
              <textarea
                ref={altRef}
                id={`media-${id}-alt`}
                rows={2}
                maxLength={255}
                defaultValue={current.alt_text ?? ''}
                onBlur={saveOnBlur('alt_text')}
                className={input}
              />
              {keywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword) => (
                    <button
                      key={keyword.keyword}
                      type="button"
                      title={keyword.source}
                      onClick={() => applyKeyword(keyword.keyword)}
                      className="rounded-md border border-blue bg-blue-soft px-2.5 py-1 text-xs font-semibold text-blue hover:bg-white"
                    >
                      {bn ? 'Focus keyword বসান' : 'Use focus keyword'}: {keyword.keyword}
                    </button>
                  ))}
                </div>
              ) : detail ? (
                <p className="text-xs text-muted">
                  {bn
                    ? 'যে article বা product-এ ছবিটি আছে, সেখানে focus keyword দিলে এখানে এক ক্লিকে Alt হিসেবে বসানো যাবে।'
                    : 'Give the article or product using this image a focus keyword, and it can be set as the alt text here in one click.'}
                </p>
              ) : null}
              <p className="text-xs text-muted">
                <a
                  href={ALT_GUIDE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue underline"
                >
                  {bn
                    ? 'ছবির উদ্দেশ্য কীভাবে লিখবেন'
                    : 'Learn how to describe the purpose of the image'}
                </a>
                {bn
                  ? '। ছবিটি শুধু সাজসজ্জার হলে খালি রাখুন।'
                  : '. Leave empty if the image is purely decorative.'}
              </p>
            </div>
          </div>
        ) : null}

        <div className={row}>
          <label htmlFor={`media-${id}-title`} className={rowLabel}>
            {bn ? 'শিরোনাম' : 'Title'}
          </label>
          <input
            id={`media-${id}-title`}
            maxLength={255}
            defaultValue={current.title ?? ''}
            onBlur={saveOnBlur('title')}
            className={input}
          />
        </div>

        <div className={row}>
          <label htmlFor={`media-${id}-caption`} className={rowLabel}>
            {image ? (bn ? 'ছবির ক্যাপশন' : 'Image Caption') : bn ? 'ক্যাপশন' : 'Caption'}
          </label>
          <textarea
            id={`media-${id}-caption`}
            rows={2}
            maxLength={512}
            defaultValue={current.caption ?? ''}
            onBlur={saveOnBlur('caption')}
            className={input}
          />
        </div>

        <div className={row}>
          <label htmlFor={`media-${id}-description`} className={rowLabel}>
            {bn ? 'বিবরণ' : 'Description'}
          </label>
          <textarea
            id={`media-${id}-description`}
            rows={3}
            maxLength={5000}
            defaultValue={current.description ?? ''}
            onBlur={saveOnBlur('description')}
            className={input}
          />
        </div>

        {current.url ? (
          <div className={row}>
            <label htmlFor={`media-${id}-url`} className={rowLabel}>
              {bn ? 'ফাইলের URL' : 'File URL'}:
            </label>
            <div className="space-y-2">
              <input
                id={`media-${id}-url`}
                readOnly
                value={current.url}
                onFocus={(event) => event.currentTarget.select()}
                className={cn(input, 'font-latin bg-surface')}
              />
              <button
                type="button"
                onClick={() => void copy()}
                className="rounded-md border border-blue bg-white px-2.5 py-1 text-xs font-semibold text-blue hover:bg-blue-soft"
              >
                {copied
                  ? bn
                    ? 'কপি হয়েছে ✓'
                    : 'Copied ✓'
                  : bn
                    ? 'URL কপি করুন'
                    : 'Copy URL to clipboard'}
              </button>
            </div>
          </div>
        ) : null}

        <p
          role="status"
          aria-live="polite"
          className={cn(
            'min-h-5 text-xs',
            status?.tone === 'error'
              ? 'text-danger'
              : status?.tone === 'saved'
                ? 'text-success'
                : 'text-muted',
          )}
        >
          {status?.text}
        </p>
      </div>

      <label className="flex items-center gap-2 border-t border-line pt-5 text-navy">
        <input
          type="checkbox"
          checked={Boolean(current.exclude_from_sitemap)}
          onChange={(event) => void save({ exclude_from_sitemap: event.target.checked })}
          className="size-4"
        />
        {bn ? 'এই ফাইলের পেজ sitemap থেকে বাদ দিন' : 'Exclude this attachment from sitemap'}
      </label>

      <p className="border-t border-line pt-5 leading-7">
        {current.attachment_path ? (
          <>
            <a
              href={current.attachment_path}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue underline"
            >
              {bn ? 'ফাইলের পেজ দেখুন' : 'View attachment page'}
            </a>
            <span className="px-1.5 text-muted">|</span>
          </>
        ) : null}
        {mode === 'dialog' ? (
          <>
            <Link href={`/dashboard/media/${id}`} className="text-blue underline">
              {bn ? 'আরও বিস্তারিত সম্পাদনা' : 'Edit more details'}
            </Link>
            <span className="px-1.5 text-muted">|</span>
          </>
        ) : null}
        {current.url ? (
          <>
            <a href={current.url} download={current.original_name} className="text-blue underline">
              {bn ? 'ফাইল ডাউনলোড' : 'Download file'}
            </a>
            <span className="px-1.5 text-muted">|</span>
          </>
        ) : null}
        <button
          type="button"
          disabled={deleting}
          onClick={() => void remove()}
          className="text-danger underline hover:brightness-90 disabled:opacity-50"
        >
          {bn ? 'স্থায়ীভাবে মুছুন' : 'Delete permanently'}
        </button>
      </p>
    </div>
  );

  const body = (
    <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex min-h-0 items-start justify-center overflow-auto p-4 sm:p-6">
        {preview}
      </div>
      <div className="min-h-0 overflow-y-auto border-t border-line bg-surface p-4 sm:p-5 md:border-s md:border-t-0">
        {sidebar}
      </div>
    </div>
  );

  if (mode === 'page') {
    return (
      <section
        aria-label={heading}
        className="mt-6 flex flex-col overflow-hidden rounded-[--radius-card] border border-line bg-white"
      >
        {body}
      </section>
    );
  }

  const nav =
    'grid size-12 place-items-center border-s border-line text-xl text-navy hover:bg-surface disabled:text-line disabled:hover:bg-transparent';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-2 sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-details-title"
        className="flex h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[--radius-card] bg-white shadow-[--shadow-raised]"
      >
        <div className="flex items-center border-b border-line">
          <h2
            id="attachment-details-title"
            className="min-w-0 flex-1 truncate px-5 text-xl font-bold text-navy"
          >
            {heading}
          </h2>
          <button
            type="button"
            className={nav}
            disabled={!onPrev}
            onClick={onPrev}
            aria-label={bn ? 'আগের ফাইল' : 'Previous media item'}
          >
            ‹
          </button>
          <button
            type="button"
            className={nav}
            disabled={!onNext}
            onClick={onNext}
            aria-label={bn ? 'পরের ফাইল' : 'Next media item'}
          >
            ›
          </button>
          <button
            ref={closeRef}
            type="button"
            className={nav}
            onClick={onClose}
            aria-label={bn ? 'বন্ধ করুন' : 'Close'}
          >
            ×
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}

/** "Edit more details": the same details on a page of their own. */
export function AttachmentDetailsPage({ item }: { item: MediaDetail }) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const router = useRouter();

  return (
    <AttachmentDetails
      item={item}
      mode="page"
      onChanged={() => router.refresh()}
      onDelete={async () => {
        const question = bn
          ? `“${item.original_name}” ফাইলটি স্থায়ীভাবে মুছে ফেলবেন?`
          : `Delete “${item.original_name}” permanently?`;

        if (!window.confirm(question)) return;

        const { deleted } = await deleteMediaFiles([item], bn);

        if (deleted > 0) {
          router.push('/dashboard/media');
        }
      }}
    />
  );
}
