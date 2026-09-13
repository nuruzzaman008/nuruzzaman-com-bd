'use client';

import { useId, useRef, useState, type ComponentProps } from 'react';

import { Prose } from '@/components/ui/prose';
import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';
import { COLORS, FONTS, SIZES, heading, spanTag, wrap, type Edit } from '@/lib/markdown-format';

/*
  Outside the component: this is a browser side effect on a DOM node, not
  render logic. insertText through execCommand keeps the browser's own undo
  history and fires a real input event; where it is unavailable the text is
  replaced directly and the event is fired by hand, so anything listening on
  the form - the SEO analysis - still sees the change.
*/
function apply(element: HTMLTextAreaElement, edit: Edit): void {
  element.focus();
  element.setSelectionRange(edit.replaceStart, edit.replaceEnd);

  const inserted =
    typeof document.queryCommandSupported === 'function' &&
    document.queryCommandSupported('insertText') &&
    document.execCommand('insertText', false, edit.text);

  if (!inserted) {
    element.setRangeText(edit.text, edit.replaceStart, edit.replaceEnd, 'end');
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  element.setSelectionRange(edit.selectionStart, edit.selectionEnd);
}

/**
 * A Markdown textarea with a formatting toolbar and a preview.
 *
 * The text stays Markdown - headings, bold and italic as Markdown, and
 * underline, colour, size and font as the few tags the server's renderer
 * allows - so what is stored is still readable source, and still safe: the
 * renderer strips anything else. The preview asks that same renderer, so it
 * shows what readers will get rather than an approximation of it.
 *
 * Colours, sizes and fonts are a fixed palette, not a picker: the colours are
 * the site's contrast-checked ones, and the fonts are the ones the site already
 * loads, so formatting cannot make a page unreadable or slower.
 *
 * A drop-in for Textarea: it takes the same props, and the textarea keeps its
 * name and value while previewing, so the form submits it as before.
 */
export function MarkdownTextarea({ className, id, ...props }: ComponentProps<'textarea'>) {
  const { t } = useLocale();
  const words = t.admin.markdownEditor;
  const ref = useRef<HTMLTextAreaElement>(null);
  const fallbackId = useId();
  const textareaId = id ?? fallbackId;
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ state: 'loading' | 'ready' | 'failed'; html: string }>({
    state: 'ready',
    html: '',
  });

  function run(make: (value: string, start: number, end: number) => Edit) {
    const element = ref.current;

    if (element) {
      apply(element, make(element.value, element.selectionStart, element.selectionEnd));
    }
  }

  function inline(before: string, after: string) {
    run((value, start, end) => wrap(value, start, end, before, after, words.placeholder));
  }

  async function togglePreview() {
    if (previewing) {
      setPreviewing(false);

      return;
    }

    setPreviewing(true);
    setPreview({ state: 'loading', html: '' });

    try {
      const response = await api<{ data: { html: string } }>('/admin/markdown/preview', {
        method: 'POST',
        body: { markdown: ref.current?.value ?? '' },
      });
      setPreview({ state: 'ready', html: response.data.html });
    } catch {
      setPreview({ state: 'failed', html: '' });
    }
  }

  const button =
    'inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm text-navy ' +
    'hover:bg-blue-soft disabled:cursor-not-allowed disabled:opacity-50 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue';
  const select =
    'min-h-9 rounded-md border border-line bg-white px-2 text-sm text-navy disabled:opacity-50';

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white focus-within:border-blue">
      <div
        role="toolbar"
        aria-label={words.toolbar}
        aria-controls={textareaId}
        className="flex flex-wrap items-center gap-1 border-b border-line bg-surface p-1.5"
      >
        {[1, 2, 3, 4, 5, 6].map((level) => {
          const label = words.heading.replace('{level}', String(level));

          return (
            <button
              key={level}
              type="button"
              className={cn(button, 'font-latin font-bold')}
              aria-label={label}
              // The page's title is already its H1; the hint says so.
              title={level === 1 ? `${label} — ${words.h1Hint}` : label}
              disabled={previewing}
              onClick={() =>
                run((value, start, end) => heading(value, start, end, level, words.placeholder))
              }
            >
              H{level}
            </button>
          );
        })}

        <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />

        <button
          type="button"
          className={cn(button, 'font-latin font-bold')}
          aria-label={words.bold}
          title={words.bold}
          disabled={previewing}
          onClick={() => inline('**', '**')}
        >
          B
        </button>
        <button
          type="button"
          className={cn(button, 'font-latin italic')}
          aria-label={words.italic}
          title={words.italic}
          disabled={previewing}
          onClick={() => inline('*', '*')}
        >
          I
        </button>
        <button
          type="button"
          className={cn(button, 'font-latin underline')}
          aria-label={words.underline}
          title={words.underline}
          disabled={previewing}
          onClick={() => inline('<u>', '</u>')}
        >
          U
        </button>

        <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />

        <select
          aria-label={words.color}
          className={select}
          value=""
          disabled={previewing}
          onChange={(event) => {
            if (event.target.value) {
              inline(spanTag('color', event.target.value), '</span>');
            }
          }}
        >
          <option value="">{words.color}</option>
          {COLORS.map((token) => (
            <option key={token} value={token}>
              {words.colors[token]}
            </option>
          ))}
        </select>

        <select
          aria-label={words.size}
          className={select}
          value=""
          disabled={previewing}
          onChange={(event) => {
            if (event.target.value) {
              inline(spanTag('size', event.target.value), '</span>');
            }
          }}
        >
          <option value="">{words.size}</option>
          {SIZES.map((token) => (
            <option key={token} value={token}>
              {words.sizes[token]}
            </option>
          ))}
        </select>

        <select
          aria-label={words.font}
          className={select}
          value=""
          disabled={previewing}
          onChange={(event) => {
            if (event.target.value) {
              inline(spanTag('font', event.target.value), '</span>');
            }
          }}
        >
          <option value="">{words.font}</option>
          {FONTS.map((token) => (
            <option key={token} value={token}>
              {words.fonts[token]}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={cn(button, 'ms-auto border border-line bg-white font-semibold')}
          aria-pressed={previewing}
          onClick={() => void togglePreview()}
        >
          {previewing ? words.write : words.preview}
        </button>
      </div>

      <textarea
        {...props}
        ref={ref}
        id={textareaId}
        hidden={previewing}
        // Its own classes, not the form kit's: the border and rounding belong
        // to the frame around the toolbar and the text, and the class helper
        // does not merge conflicting utilities.
        className={cn(
          'block min-h-32 w-full resize-y bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70',
          'focus:outline-none aria-[invalid=true]:bg-danger-soft',
          className,
        )}
      />

      {previewing ? (
        <div className="min-h-32 p-4" aria-live="polite">
          {preview.state === 'loading' ? (
            <p className="text-sm text-muted">{words.previewLoading}</p>
          ) : preview.state === 'failed' ? (
            <p className="text-sm text-danger">{words.previewFailed}</p>
          ) : preview.html ? (
            <Prose html={preview.html} />
          ) : (
            <p className="text-sm text-muted">{words.previewEmpty}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
