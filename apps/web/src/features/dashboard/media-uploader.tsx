'use client';

import { useRef, useState } from 'react';

import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { fileSize } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { readVideoDuration } from '@/lib/media/video-duration';
import { uploadInParts } from '@/lib/uploads/chunked-upload';

/** The same list the API accepts; see Admin\MediaController. */
export const MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'application/pdf',
  'video/mp4',
  'video/webm',
];

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

type Row = {
  key: string;
  name: string;
  progress: number;
  state: 'waiting' | 'uploading' | 'done' | 'failed';
  message?: string;
};

/**
 * WordPress's "Add New Media File": drop files or pick them. Every file goes
 * up in parts - the host refuses a request over 2 MB - so a 300 MB video
 * uploads the same way a small image does, with its progress shown.
 */
export function MediaUploader({ onUploaded }: { onUploaded: () => void }) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function problemWith(file: File): string | null {
    if (!MEDIA_TYPES.includes(file.type)) {
      return bn
        ? 'এই ধরনের ফাইল নেওয়া হয় না। ছবি (JPG, PNG, WebP, AVIF, SVG), PDF বা ভিডিও (MP4, WebM) দিন।'
        : 'This kind of file is not accepted. Use an image (JPG, PNG, WebP, AVIF, SVG), a PDF or a video (MP4, WebM).';
    }

    const limit = file.type.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;

    if (file.size > limit) {
      return bn
        ? `ফাইলটি অনেক বড়; সর্বোচ্চ ${fileSize(limit)}।`
        : `The file is too large; the limit is ${fileSize(limit)}.`;
    }

    return null;
  }

  async function upload(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const stamp = Date.now();
    const queued = files.map((file, index) => ({
      file,
      row: { key: `${stamp}-${index}`, name: file.name, progress: 0, state: 'waiting' as const },
    }));

    setRows((current) => [...queued.map(({ row }) => row), ...current]);
    setBusy(true);

    let uploaded = 0;

    for (const { file, row } of queued) {
      const problem = problemWith(file);

      if (problem) {
        update(row.key, { state: 'failed', message: problem });
        continue;
      }

      update(row.key, { state: 'uploading' });

      try {
        const duration = file.type.startsWith('video/') ? await readVideoDuration(file) : null;
        const parts = await uploadInParts(file, (fraction) =>
          update(row.key, { progress: fraction }),
        );

        await api('/admin/media', {
          method: 'POST',
          body: { ...parts, duration_seconds: duration },
        });

        update(row.key, { state: 'done', progress: 1 });
        uploaded += 1;
      } catch (caught) {
        update(row.key, {
          state: 'failed',
          message:
            caught instanceof Error && caught.message
              ? caught.message
              : bn
                ? 'আপলোড করা যায়নি।'
                : 'The upload failed.',
        });
      }
    }

    setBusy(false);

    if (inputRef.current) {
      inputRef.current.value = '';
    }

    if (uploaded > 0) {
      onUploaded();
    }
  }

  const stateLabel: Record<Row['state'], string> = {
    waiting: bn ? 'অপেক্ষায়' : 'Waiting',
    uploading: bn ? 'আপলোড হচ্ছে' : 'Uploading',
    done: bn ? 'সম্পন্ন' : 'Done',
    failed: bn ? 'ব্যর্থ' : 'Failed',
  };

  return (
    <div className="mt-4 rounded-[--radius-card] border border-line bg-white p-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-10 text-center',
          dragging ? 'border-blue bg-blue-soft' : 'border-line',
        )}
      >
        <p className="text-lg font-semibold text-navy">
          {bn ? 'ফাইল এখানে টেনে এনে ছাড়ুন' : 'Drop files to upload'}
        </p>
        <p className="text-sm text-muted">{bn ? 'অথবা' : 'or'}</p>
        <label
          className={cn(
            'inline-flex min-h-10 cursor-pointer items-center rounded-md border border-blue px-4 text-sm font-semibold text-blue hover:bg-blue-soft',
            'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue',
            busy && 'pointer-events-none opacity-50',
          )}
        >
          {bn ? 'ফাইল বাছাই করুন' : 'Select Files'}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={MEDIA_TYPES.join(',')}
            disabled={busy}
            className="sr-only"
            onChange={(event) => void upload(Array.from(event.target.files ?? []))}
          />
        </label>
        <p className="text-xs text-muted">
          {bn
            ? 'ছবি ও PDF সর্বোচ্চ 20 MB, ভিডিও (MP4, WebM) সর্বোচ্চ 300 MB।'
            : 'Images and PDFs up to 20 MB; MP4 and WebM videos up to 300 MB.'}
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm" aria-live="polite">
          {rows.map((row) => (
            <li key={row.key} className="rounded-md border border-line px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-latin min-w-0 truncate text-navy">{row.name}</span>
                <span
                  className={cn(
                    'shrink-0 text-xs font-semibold',
                    row.state === 'failed'
                      ? 'text-danger'
                      : row.state === 'done'
                        ? 'text-success'
                        : 'text-muted',
                  )}
                >
                  {stateLabel[row.state]}
                  {row.state === 'uploading' ? ` ${Math.round(row.progress * 100)}%` : ''}
                </span>
              </div>
              {row.state === 'uploading' ? (
                <div
                  role="progressbar"
                  aria-label={row.name}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(row.progress * 100)}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"
                >
                  <div
                    className="h-full bg-blue"
                    style={{ width: `${Math.round(row.progress * 100)}%` }}
                  />
                </div>
              ) : null}
              {row.message ? <p className="mt-1 text-xs text-danger">{row.message}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
