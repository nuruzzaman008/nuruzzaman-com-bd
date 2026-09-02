import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const TONES: Record<Tone, { box: string; label: string }> = {
  info: { box: 'border-blue/30 bg-blue-soft', label: 'text-blue' },
  warning: { box: 'border-amber/50 bg-amber-soft', label: 'text-navy' },
  danger: { box: 'border-danger/30 bg-danger-soft', label: 'text-danger' },
  success: { box: 'border-success/30 bg-success-soft', label: 'text-success' },
};

export function Callout({
  title,
  tone = 'info',
  children,
  className,
  role,
}: {
  title?: string;
  tone?: Tone;
  children: ReactNode;
  className?: string;
  role?: 'status' | 'alert';
}) {
  const styles = TONES[tone];

  return (
    <div
      role={role}
      className={cn('rounded-[--radius-card] border p-4 text-sm', styles.box, className)}
    >
      {title ? <p className={cn('font-semibold', styles.label)}>{title}</p> : null}
      <div className={cn('text-ink', title && 'mt-1')}>{children}</div>
    </div>
  );
}
