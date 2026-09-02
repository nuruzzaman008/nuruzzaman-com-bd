import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type Column<T> = {
  key: string;
  header: string;
  /** Right-align numeric columns so figures line up. */
  align?: 'start' | 'end';
  render: (row: T) => ReactNode;
};

/**
 * A responsive table. The wrapper scrolls horizontally on narrow screens so the
 * page body itself never scrolls sideways.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  caption?: string;
  empty?: ReactNode;
  className?: string;
}) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      className={cn(
        'overflow-x-auto rounded-[--radius-card] border border-line bg-white',
        className,
      )}
    >
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-line bg-surface">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-4 py-3 font-semibold text-navy',
                  column.align === 'end' ? 'text-end' : 'text-start',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-line last:border-0">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-4 py-3 align-middle',
                    column.align === 'end' ? 'text-end' : 'text-start',
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
