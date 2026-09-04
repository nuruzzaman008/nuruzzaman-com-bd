import { cn } from '@/lib/cn';

/**
 * Renders HTML that the API produced from Markdown.
 *
 * The API strips raw HTML and drops unsafe links before this ever runs, so the
 * only trusted input here is our own server's output - never anything a browser
 * supplied.
 *
 * Every body rendered here is authored content, so it carries `data-authored`.
 * That marks it as text written in one language on purpose: the English-page
 * check reads the attribute and does not report an untranslated article body as
 * an untranslated interface.
 */
export function Prose({ html, className }: { html: string; className?: string }) {
  return (
    <div
      data-authored="true"
      className={cn('prose-nb', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
