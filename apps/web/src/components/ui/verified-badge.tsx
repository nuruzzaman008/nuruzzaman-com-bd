import { cn } from '@/lib/cn';

/**
 * The blue badge beside a verified name, drawn the way Facebook draws its
 * own: a white tick on a blue, scalloped seal. The API decides who earns it
 * (verified_badge); this only draws it.
 */
export function VerifiedBadge({
  label,
  className,
}: {
  /** Read out and shown on hover, e.g. "Verified profile". */
  label: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('inline-block size-5 shrink-0 align-[-0.2em] text-[#0866ff]', className)}
    >
      <svg viewBox="0 0 24 24" className="size-full" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 1.5l2.2 1.6 2.7-.3 1.1 2.5 2.5 1.1-.3 2.7 1.6 2.2-1.6 2.2.3 2.7-2.5 1.1-1.1 2.5-2.7-.3L12 22.5l-2.2-1.6-2.7.3-1.1-2.5-2.5-1.1.3-2.7L2.2 12l1.6-2.2-.3-2.7 2.5-1.1 1.1-2.5 2.7.3L12 1.5z"
        />
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.8 12.3l2.8 2.8 5.6-5.8"
        />
      </svg>
    </span>
  );
}
