'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * The honest "there is nothing here" state. Used instead of inventing
 * placeholder rows so a reader is never shown data that does not exist.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[--radius-card] border border-dashed border-line bg-white px-6 py-12 text-center',
        className,
      )}
    >
      <p className="text-base font-semibold text-navy">{title}</p>
      {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-line/70', className)}
    />
  );
}

/** A loading region that announces itself once, rather than on every tick. */
export function LoadingRegion({ label }: { label?: string }) {
  const { t } = useLocale();

  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label ?? t.ui.loading}</span>
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function ValuePending({ label }: { label: string }) {
  return (
    <span className="text-sm text-muted italic">
      {label}
    </span>
  );
}
