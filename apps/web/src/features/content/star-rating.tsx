'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';

const STARS = [1, 2, 3, 4, 5] as const;

function Star({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('size-full', className)}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 16.95 6.75 19.7l1-5.85L3.5 9.7l5.9-.9z" />
    </svg>
  );
}

/**
 * A rating, shown but not editable.
 *
 * The number is in the accessible name rather than left to the shapes: five
 * outlines and three fills is not something a screen reader can convey, and
 * counting them by eye is not something a sighted reader should have to do
 * either - which is why the figure is printed beside them.
 */
export function StarDisplay({
  value,
  count,
  className,
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  const { t } = useLocale();
  const rounded = Math.round(value);

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="flex items-center gap-0.5 text-amber" aria-hidden="true">
        {STARS.map((star) => (
          <span key={star} className="size-4">
            <Star filled={star <= rounded} />
          </span>
        ))}
      </span>
      <span className="font-latin text-sm font-semibold text-navy">{value.toFixed(1)}</span>
      {count === undefined ? null : (
        <span className="text-xs text-muted">
          ({t.comments.fromCount.replace('{count}', String(count))})
        </span>
      )}
      <span className="sr-only">
        {t.comments.outOfFive.replace('{value}', value.toFixed(1))}
      </span>
    </span>
  );
}

/**
 * The rating control in the comment form.
 *
 * Radio buttons rather than clickable icons: a radio group is what this is, so
 * the keyboard, the screen reader and the form all get it for free. The visible
 * stars are decoration layered on top of real inputs.
 *
 * Optional on purpose. A reader may want to ask a question without scoring the
 * article, and forcing a star out of them would make every average meaningless.
 */
export function StarInput({ name = 'rating' }: { name?: string }) {
  const { t } = useLocale();
  const [value, setValue] = useState(0);
  const [hovered, setHovered] = useState(0);

  const shown = hovered || value;

  return (
    <fieldset>
      <legend className="block text-sm font-semibold text-navy">
        {t.comments.ratingLabel}{' '}
        <span className="font-normal text-muted">{t.comments.ratingOptional}</span>
      </legend>

      <div
        className="mt-2 flex items-center gap-1"
        onMouseLeave={() => setHovered(0)}
      >
        {STARS.map((star) => (
          <label
            key={star}
            onMouseEnter={() => setHovered(star)}
            className={cn(
              'cursor-pointer rounded p-0.5 transition-colors',
              'focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-blue',
              star <= shown ? 'text-amber' : 'text-line hover:text-amber/60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => setValue(star)}
              className="sr-only"
            />
            <span className="sr-only">
              {t.comments.starCount.replace('{count}', String(star))}
            </span>
            <span className="block size-7">
              <Star filled={star <= shown} />
            </span>
          </label>
        ))}

        {value > 0 ? (
          <button
            type="button"
            onClick={() => setValue(0)}
            className="ms-2 min-h-9 rounded-lg px-2 text-xs font-medium text-muted hover:text-blue"
          >
            {t.comments.clearRating}
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
