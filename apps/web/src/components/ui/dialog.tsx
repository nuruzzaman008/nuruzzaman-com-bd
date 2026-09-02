'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

/**
 * A modal built on the native <dialog> element, so focus trapping, Escape and
 * the top layer come from the platform rather than from hand-written handlers.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-description' : undefined}
      onClose={onClose}
      onCancel={onClose}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-[--radius-card] border border-line bg-white p-0 text-ink backdrop:bg-navy/50"
    >
      <div className="p-6">
        <h2 id="dialog-title" className="text-lg font-bold text-navy">
          {title}
        </h2>
        {description ? (
          <p id="dialog-description" className="mt-1 text-sm text-muted">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
      <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
        {footer ?? (
          <Button type="button" variant="secondary" onClick={onClose}>
            বন্ধ করুন
          </Button>
        )}
      </div>
    </dialog>
  );
}
