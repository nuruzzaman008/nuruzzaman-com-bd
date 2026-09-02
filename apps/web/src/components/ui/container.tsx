import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Container({
  children,
  className,
  size = 'default',
}: {
  children: ReactNode;
  className?: string;
  size?: 'default' | 'wide' | 'narrow';
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6 lg:px-8',
        size === 'narrow' && 'max-w-3xl',
        size === 'default' && 'max-w-6xl',
        size === 'wide' && 'max-w-7xl',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  tone = 'surface',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'surface' | 'white' | 'navy' | 'blue';
}) {
  return (
    <section
      className={cn(
        'py-12 sm:py-16',
        tone === 'surface' && 'bg-surface',
        tone === 'white' && 'bg-white',
        tone === 'navy' && 'bg-navy text-white',
        tone === 'blue' && 'bg-blue-soft',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'start',
  tone = 'dark',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'start' | 'center';
  tone?: 'dark' | 'light';
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow ? (
        <p
          className={cn(
            'font-latin text-xs font-semibold tracking-[0.18em] uppercase',
            tone === 'dark' ? 'text-teal' : 'text-amber',
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          'mt-2 text-[length:var(--step-h2)] leading-tight font-bold',
          tone === 'dark' ? 'text-navy' : 'text-white',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn('mt-3 text-base', tone === 'dark' ? 'text-muted' : 'text-white/80')}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
