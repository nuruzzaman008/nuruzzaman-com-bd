import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/**
 * Sizes keep a practical 44px touch target at `md` and above, which is what the
 * accessibility target in the spec asks for.
 */
const SIZES: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 text-sm gap-2',
  lg: 'min-h-12 px-6 text-base gap-2',
};

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue text-white hover:bg-navy active:bg-navy shadow-sm',
  secondary: 'bg-white text-navy border border-line hover:border-blue hover:text-blue',
  ghost: 'bg-transparent text-navy hover:bg-blue-soft',
  danger: 'bg-danger text-white hover:brightness-95',
};

const BASE =
  'inline-flex items-center justify-center rounded-lg font-semibold transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-3 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-blue';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return (
    <button className={cn(BASE, SIZES[size], VARIANTS[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={cn(BASE, SIZES[size], VARIANTS[variant], className)} {...props}>
      {children}
    </Link>
  );
}
