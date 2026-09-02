import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'teal';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface text-muted border-line',
  info: 'bg-blue-soft text-blue border-blue/20',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-amber-soft text-navy border-amber/40',
  danger: 'bg-danger-soft text-danger border-danger/20',
  teal: 'bg-teal-soft text-teal border-teal/20',
};

/**
 * Status badges always carry a word, never colour alone, so meaning survives
 * for colour-blind readers and in high-contrast mode.
 */
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
