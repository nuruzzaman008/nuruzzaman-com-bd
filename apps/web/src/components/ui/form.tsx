'use client';

import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Form primitives.
 *
 * Every field wires its label, hint and error together with ids so a screen
 * reader announces all three, and errors are marked `aria-invalid` rather than
 * being signalled by colour alone.
 */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    required?: boolean;
  }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-navy">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (আবশ্যক)</span> : null}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required,
      })}

      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL =
  'block w-full min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink ' +
  'placeholder:text-muted/70 focus:border-blue focus-visible:outline-3 focus-visible:outline-offset-1 ' +
  'focus-visible:outline-blue aria-[invalid=true]:border-danger';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'min-h-32 resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(CONTROL, className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  error,
  className,
  ...props
}: ComponentProps<'input'> & { label: ReactNode; error?: string }) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-describedby={errorId}
          aria-invalid={error ? true : undefined}
          className="mt-1 size-5 shrink-0 rounded border-line text-blue focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue"
          {...props}
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-ink">
          {label}
        </label>
      </div>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A single summary at the top of a form that links to each failing field. This
 * is what makes a long form usable with a keyboard and a screen reader.
 */
export function ErrorSummary({
  title = 'ফর্মে কিছু সমস্যা আছে',
  errors,
}: {
  title?: string;
  errors: Record<string, string[] | string> | undefined;
}) {
  const entries = Object.entries(errors ?? {});

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      role="alert"
      tabIndex={-1}
      className="rounded-[--radius-card] border border-danger/30 bg-danger-soft p-4"
    >
      <p className="font-semibold text-danger">{title}</p>
      <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-ink">
        {entries.map(([field, message]) => (
          <li key={field}>{Array.isArray(message) ? message[0] : message}</li>
        ))}
      </ul>
    </div>
  );
}
