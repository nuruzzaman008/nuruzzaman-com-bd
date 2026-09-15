'use client';

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type InputHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { fileSize } from '@/lib/format';
import { Button } from './button';
import { Dialog } from './dialog';

type Item = {
  id: number;
  source: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  /** A public library file's address; null for anything private. */
  url?: string | null;
};
type Props = InputHTMLAttributes<HTMLInputElement> & {
  scope?: 'public' | 'personal' | 'course';
  courseId?: number;
  /**
   * Receives a chosen public file's address instead of a copy of the file, so
   * a field that only needs the address (the article editor) neither
   * downloads nor uploads it again - a video would be duplicated otherwise.
   */
  onPickExisting?: (item: { url: string; name: string; mime_type: string | null }) => void;
  /** The button's words, where the default "Choose from Media / Upload" is not enough. */
  triggerLabel?: string;
  /** Extra classes for a larger, more prominent button. */
  triggerClassName?: string;
};

export function acceptsFile(name: string, mime: string, accept = ''): boolean {
  if (!accept) return true;
  return accept.split(',').some((value) => {
    const rule = value.trim().toLowerCase();
    if (rule.startsWith('.')) return name.toLowerCase().endsWith(rule);
    if (rule.endsWith('/*')) return mime.startsWith(rule.slice(0, -1));
    if (mime) return mime === rule;
    const extensions: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/avif': ['.avif'],
      'application/pdf': ['.pdf'],
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
    };
    return extensions[rule]?.some((ext) => name.toLowerCase().endsWith(ext)) ?? false;
  });
}

/** Keeps the existing upload field and its validation; only changes how files are chosen. */
export const MediaFileInput = forwardRef<HTMLInputElement, Props>(function MediaFileInput(
  {
    scope = 'personal',
    courseId,
    className,
    onChange,
    onPickExisting,
    triggerLabel,
    triggerClassName,
    ...props
  },
  ref,
) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const input = useRef<HTMLInputElement>(null);
  const newInput = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => input.current!, []);
  const ownId = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [names, setNames] = useState('');
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setNames('');
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, []);
  const requestSerial = useRef(0);
  const parameters = () => ({ scope, ...(courseId ? { course_id: courseId } : {}) });

  async function load(nextPage = 1, q = query) {
    const serial = ++requestSerial.current;
    setLoading(true);
    setError('');
    try {
      const result = await api<{ data: Item[]; last_page: number }>('/uploads/library', {
        query: { ...parameters(), q, page: nextPage },
      });
      if (serial !== requestSerial.current) return;
      setItems(result.data);
      setPage(nextPage);
      setLastPage(result.last_page);
    } catch (e) {
      if (serial === requestSerial.current)
        setError(e instanceof Error ? e.message : 'Media could not load.');
    } finally {
      if (serial === requestSerial.current) setLoading(false);
    }
  }

  function show() {
    if (props.disabled) return;
    setOpen(true);
    setSelected([]);
    void load(1);
  }
  function finish(files: File[]) {
    if (!input.current || !files.length) return;
    const transfer = new DataTransfer();
    for (const file of props.multiple ? files : files.slice(0, 1)) transfer.items.add(file);
    input.current.files = transfer.files;
    // A real change event preserves FormData, required fields, and existing upload callbacks.
    input.current.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false);
  }
  async function attach() {
    const picked = selected[0];

    if (onPickExisting && !props.multiple && picked?.url) {
      onPickExisting({ url: picked.url, name: picked.name, mime_type: picked.mime_type });
      setNames(picked.name);
      setOpen(false);

      return;
    }

    setBusy(true);
    setError('');
    try {
      const files: File[] = [];
      for (const item of selected) {
        const query = new URLSearchParams(
          Object.entries(parameters()).map(([key, value]) => [key, String(value)]),
        );
        const response = await fetch(
          `/api/v1/uploads/library/${encodeURIComponent(item.source)}/${item.id}?${query}`,
          { credentials: 'include', cache: 'no-store' },
        );
        if (!response.ok)
          throw new Error(
            bn
              ? 'ফাইলটি খোলা যাচ্ছে না। আপনার অনুমতি বা ফাইলটি আছে কি না দেখুন।'
              : 'Cannot open this file. Check access or whether it still exists.',
          );
        const blob = await response.blob();
        if (!acceptsFile(item.name, blob.type, props.accept))
          throw new Error(
            bn
              ? 'এই জায়গায় এই ধরনের ফাইল ব্যবহার করা যাবে না।'
              : 'This file type cannot be attached here.',
          );
        files.push(new File([blob], item.name, { type: blob.type }));
      }
      finish(files);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to attach.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        {...props}
        id={props.id ?? ownId}
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        onClick={(event) => {
          event.preventDefault();
          show();
        }}
        onInvalid={(event) => {
          event.preventDefault();
          show();
        }}
        onChange={(event) => {
          setNames(
            Array.from(event.currentTarget.files ?? [])
              .map((file) => file.name)
              .join(', '),
          );
          onChange?.(event);
        }}
      />
      {!className?.includes('sr-only') && (
        <span className="mt-2 block space-y-2">
          <Button
            type="button"
            size={triggerClassName ? 'lg' : 'md'}
            className={triggerClassName}
            disabled={props.disabled || busy}
            onClick={show}
          >
            {triggerLabel ?? (bn ? 'Media থেকে ফাইল বাছুন / আপলোড' : 'Choose from Media / Upload')}
          </Button>
          {names && <span className="block break-all text-sm text-muted">{names}</span>}
        </span>
      )}
      {open &&
        createPortal(
          <Dialog
            open={open}
            onClose={() => {
              if (!busy) setOpen(false);
            }}
            title={bn ? 'Media — আগের আপলোড করা ফাইল' : 'Media — previously uploaded files'}
            description={
              scope === 'public'
                ? bn
                  ? 'ওয়েবসাইটের public Media।'
                  : 'Public website media.'
                : bn
                  ? 'শুধু আপনার বা আপনার অনুমোদিত কোর্সের ফাইল।'
                  : 'Only your files or files from courses you can manage.'
            }
            footer={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  {bn ? 'বাতিল' : 'Cancel'}
                </Button>
                <Button
                  type="button"
                  disabled={busy || !selected.length}
                  onClick={() => void attach()}
                >
                  {busy ? '…' : bn ? 'বাছাই করা ফাইল যুক্ত করুন' : 'Attach selected'}
                </Button>
              </>
            }
          >
            <div className="flex gap-2">
              <input
                aria-label={bn ? 'ফাইল খুঁজুন' : 'Search files'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void load(1);
                  }
                }}
                className="min-w-0 flex-1 rounded border border-line p-2"
              />
              <Button type="button" disabled={loading || busy} onClick={() => void load(1)}>
                {bn ? 'খুঁজুন' : 'Search'}
              </Button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
            {loading ? (
              <p role="status" className="my-4">
                {bn ? 'Media লোড হচ্ছে…' : 'Loading Media…'}
              </p>
            ) : (
              <ul className="my-3 max-h-64 space-y-2 overflow-y-auto">
                {items.map((item) => {
                  const checked = selected.some(
                    (row) => row.id === item.id && row.source === item.source,
                  );
                  const allowed = acceptsFile(item.name, item.mime_type ?? '', props.accept);
                  return (
                    <li key={`${item.source}-${item.id}`}>
                      <label
                        className={`flex cursor-pointer gap-3 rounded border p-3 ${checked ? 'border-blue bg-blue-soft' : 'border-line'} ${!allowed ? 'opacity-50' : ''}`}
                      >
                        <input
                          type={props.multiple ? 'checkbox' : 'radio'}
                          name={`library-${ownId}`}
                          checked={checked}
                          disabled={busy || !allowed}
                          onChange={() =>
                            setSelected((current) =>
                              checked
                                ? current.filter(
                                    (row) => row.id !== item.id || row.source !== item.source,
                                  )
                                : props.multiple
                                  ? [...current, item]
                                  : [item],
                            )
                          }
                        />
                        <span className="min-w-0 break-all text-sm">
                          {item.name}
                          <span className="block text-xs text-muted">
                            {item.mime_type || item.source}
                            {item.size_bytes ? ` · ${fileSize(item.size_bytes)}` : ''}
                            {!allowed
                              ? bn
                                ? ' · এই জায়গার জন্য নয়'
                                : ' · Not supported here'
                              : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
                {!items.length && (
                  <li className="py-4 text-sm text-muted">
                    {bn
                      ? 'আগের ফাইল পাওয়া যায়নি। নিচে নতুন ফাইল আপলোড করুন।'
                      : 'No files found. Upload a new file below.'}
                  </li>
                )}
              </ul>
            )}
            <div className="flex items-center justify-between text-sm">
              <Button
                type="button"
                variant="secondary"
                disabled={page <= 1 || loading || busy}
                onClick={() => void load(page - 1)}
              >
                {bn ? 'আগের' : 'Previous'}
              </Button>
              <span>
                {page} / {lastPage}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={page >= lastPage || loading || busy}
                onClick={() => void load(page + 1)}
              >
                {bn ? 'পরের' : 'Next'}
              </Button>
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="font-bold">{bn ? 'নতুন ফাইল আপলোড' : 'Upload new file'}</h3>
              <p className="my-2 text-sm text-muted">
                {bn
                  ? 'ফাইলটি এখানে না থাকলে নতুন ফাইল বাছুন। আগের মতো ফর্ম সংরক্ষণ / জমা দিলে আপলোড হবে।'
                  : 'If the file is not here, choose a new one. Save or submit the original form to complete its upload.'}
              </p>
              <input
                ref={newInput}
                type="file"
                aria-label={bn ? 'নতুন ফাইল বাছুন' : 'Choose new files'}
                accept={props.accept}
                multiple={props.multiple}
                disabled={busy}
                className="block w-full text-sm file:rounded file:border-0 file:bg-blue file:px-3 file:py-2 file:text-white"
                onChange={(e) => finish(Array.from(e.target.files ?? []))}
              />
            </div>
          </Dialog>,
          document.body,
        )}
    </>
  );
});
