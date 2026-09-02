import { cn } from '@/lib/cn';

/**
 * Renders HTML that the API produced from Markdown.
 *
 * The API strips raw HTML and drops unsafe links before this ever runs, so the
 * only trusted input here is our own server's output - never anything a browser
 * supplied.
 */
export function Prose({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn('prose-nb', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
