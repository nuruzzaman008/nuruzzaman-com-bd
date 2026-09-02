import { cn } from '@/lib/cn';

export type TocEntry = { level: number; text: string; id: string };

export function TableOfContents({
  entries,
  className,
}: {
  entries: TocEntry[];
  className?: string;
}) {
  if (entries.length < 2) {
    return null;
  }

  return (
    <nav aria-labelledby="toc-heading" className={cn('text-sm', className)}>
      <h2 id="toc-heading" className="font-semibold text-navy">
        এই লেখায় যা আছে
      </h2>
      <ol className="mt-3 space-y-2 border-s border-line ps-4">
        {entries.map((entry) => (
          <li key={entry.id} className={cn(entry.level > 2 && 'ps-3')}>
            <a href={`#${entry.id}`} className="text-muted hover:text-blue hover:underline">
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
